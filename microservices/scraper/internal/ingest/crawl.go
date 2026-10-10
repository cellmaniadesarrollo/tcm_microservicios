package ingest

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/tu-org/tcm-scraper/internal/gsmarena"
	"github.com/tu-org/tcm-scraper/internal/store"
)

var (
	ErrSoftBlock  = errors.New("demasiados fallos seguidos (posible bloqueo)")
	errBudget     = errors.New("presupuesto de requests agotado")
	errPageLimit  = errors.New("límite de páginas de listado alcanzado")
	errSpecsLimit = errors.New("límite de fichas por ejecución alcanzado")
)

type Options struct {
	StaleAfter     time.Duration // volver a pedir fichas más viejas que esto
	ListingRefresh time.Duration // volver a recorrer el listado completo cada tanto
	MaxRequests    int           // tope de peticiones por ejecución (0 = sin límite)
	MaxPages       int           // páginas de listado por ejecución (0 = todas)
	MaxSpecs       int           // fichas por ejecución (0 = todas)
	CooldownBase   time.Duration // espera tras el primer bloqueo
	CooldownMax    time.Duration // tope de la espera
	MaxConsecFails int           // fallos seguidos antes de pausar
	Batch          int           // tamaño de lote de la cola de fichas
}

type Crawler struct {
	c   *gsmarena.Client
	st  *store.Store
	log *slog.Logger
	opt Options
	mu  sync.Mutex
}

func NewCrawler(c *gsmarena.Client, st *store.Store, log *slog.Logger, opt Options) *Crawler {
	if opt.MaxConsecFails <= 0 {
		opt.MaxConsecFails = 3
	}
	if opt.Batch <= 0 {
		opt.Batch = 100
	}
	if opt.CooldownBase <= 0 {
		opt.CooldownBase = time.Hour
	}
	if opt.CooldownMax <= 0 {
		opt.CooldownMax = 12 * time.Hour
	}
	if opt.StaleAfter <= 0 {
		opt.StaleAfter = 30 * 24 * time.Hour
	}
	if opt.ListingRefresh <= 0 {
		opt.ListingRefresh = 30 * 24 * time.Hour
	}
	return &Crawler{c: c, st: st, log: log, opt: opt}
}

// save persiste el estado aunque ctx ya esté cancelado (apagado del servicio).
func (r *Crawler) save(state *store.CrawlState) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := r.st.SaveState(ctx, state); err != nil {
		r.log.Error("guardar estado", "err", err)
	}
}

// Run ejecuta o reanuda el crawl. Nunca devuelve error: lo deja en el estado.
func (r *Crawler) Run(ctx context.Context, now time.Time) {
	if !r.mu.TryLock() {
		r.log.Warn("crawl ya en curso, se omite")
		return
	}
	defer r.mu.Unlock()

	state, err := r.st.LoadState(ctx, store.SourceGSMArena)
	if err != nil {
		r.log.Error("cargar estado", "err", err)
		return
	}

	today := now.Format("2006-01-02")
	switch {
	case state == nil || (state.Status == "done" && state.RunDay != today):
		// Ciclo nuevo. Si el listado ya está completo, se conserva (no se repite a diario).
		prev := state
		state = &store.CrawlState{ID: store.SourceGSMArena, RunDay: today, StartedAt: now.UTC()}
		if prev != nil && prev.ListingDone {
			state.ListingDone = true
			state.ListingDoneAt = prev.ListingDoneAt
		}
		r.log.Info("nuevo ciclo", "dia", today, "listado_reutilizado", state.ListingDone)
	case state.Status == "done":
		r.log.Info("el ciclo de hoy ya está completo")
		return
	case state.Status == "blocked" && time.Now().Before(state.BlockedUntil):
		r.log.Info("aún en enfriamiento", "hasta", state.BlockedUntil)
		return
	default:
		r.log.Info("reanudando ciclo", "dia", state.RunDay, "estado_previo", state.Status,
			"listado_completo", state.ListingDone, "marcas_hechas", len(state.DoneBrands))
	}

	// Listado completo: decidir si ya toca recorrerlo otra vez (cada 30 días).
	if state.ListingDone {
		switch {
		case state.ListingDoneAt.IsZero():
			// estado antiguo sin fecha: se le pone la de hoy
			state.ListingDoneAt = time.Now().UTC()
		case time.Since(state.ListingDoneAt) > r.opt.ListingRefresh:
			r.log.Info("listado vencido, se recorre de nuevo desde la primera marca")
			state.ListingDone = false
			state.DoneBrands = nil
			state.BrandSourceID, state.NextPath = "", ""
		}
	}

	state.Status = "running"
	state.LastError = ""
	state.BlockedUntil = time.Time{}
	r.save(state)

	startReqs := r.c.Requests()
	budgetOK := func() bool {
		return r.opt.MaxRequests <= 0 || r.c.Requests()-startReqs < int64(r.opt.MaxRequests)
	}

	// 1) Modelos (listado)
	listingWasDone := state.ListingDone // si ya estaba completo, solo se buscan modelos nuevos
	runErr := r.crawlListing(ctx, state, budgetOK)
	pageLimitHit := false
	if errors.Is(runErr, errPageLimit) {
		// Se llegó al tope de páginas: no es un error, se sigue con las fichas.
		pageLimitHit = true
		runErr = nil
	}

	// 1b) Revisión diaria de modelos nuevos (comparar totales por marca)
	if runErr == nil && listingWasDone && state.NewCheckDay != today {
		runErr = r.syncNewModels(ctx, state, budgetOK)
		if runErr == nil {
			state.NewCheckDay = today
			r.save(state)
		}
	}

	// 2) Fichas de los modelos que no la tienen
	if runErr == nil {
		runErr = r.crawlSpecs(ctx, state, budgetOK)
	}

	// Si el listado quedó a medias y todo lo demás salió bien, queda en pausa.
	if runErr == nil && pageLimitHit {
		runErr = errPageLimit
	}
	r.finish(state, runErr)
}

func (r *Crawler) crawlListing(ctx context.Context, state *store.CrawlState, budgetOK func() bool) error {
	if state.ListingDone {
		return nil
	}
	if !budgetOK() {
		return errBudget
	}
	brands, err := r.c.Brands(ctx)
	if err != nil {
		return err
	}

	done := make(map[string]bool, len(state.DoneBrands))
	for _, id := range state.DoneBrands {
		done[id] = true
	}

	pages := 0 // páginas leídas en esta ejecución

	for _, b := range brands {
		if done[b.FindID] {
			continue
		}
		path := b.Path
		if state.BrandSourceID == b.FindID && state.NextPath != "" {
			path = state.NextPath // reanudar en la página donde quedó
		}

		for path != "" {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			if r.opt.MaxPages > 0 && pages >= r.opt.MaxPages {
				return errPageLimit
			}
			if !budgetOK() {
				return errBudget
			}

			models, next, err := r.c.ModelsPage(ctx, b, path)
			if err != nil {
				var se *gsmarena.StatusError
				if errors.As(err, &se) && (se.Status == 404 || se.Status == 410) {
					r.log.Warn("página inexistente, se omite", "marca", b.Name, "path", path)
					break
				}
				return err
			}
			// 200 sin modelos en una marca que tiene dispositivos = página de bloqueo
			if len(models) == 0 && b.DevicesCount > 0 {
				return fmt.Errorf("%w: página vacía de %s (%s)", ErrSoftBlock, b.Name, path)
			}

			if err := r.st.UpsertDevicesBasic(ctx, b, models); err != nil {
				return err
			}
			pages++
			state.Stats.Devices += len(models)
			state.BrandSourceID, state.NextPath = b.FindID, next
			r.save(state) // aquí queda guardado el cursor (marca y página)
			path = next
		}

		// Verificar que la marca quedó completa antes de darla por hecha.
		got, err := r.st.CountBrandDevices(ctx, b.FindID)
		if err != nil {
			return err
		}
		if b.DevicesCount > 0 && got < int64(b.DevicesCount)*9/10 {
			return fmt.Errorf("%w: %s quedó incompleta (%d de %d)", ErrSoftBlock, b.Name, got, b.DevicesCount)
		}

		state.DoneBrands = append(state.DoneBrands, b.FindID)
		state.BrandSourceID, state.NextPath = "", ""
		r.save(state)
		r.log.Info("marca lista", "marca", b.Name, "hechas", len(state.DoneBrands), "total", len(brands))
	}

	state.ListingDone = true
	state.ListingDoneAt = time.Now().UTC()
	r.save(state)
	return nil
}

func (r *Crawler) crawlSpecs(ctx context.Context, state *store.CrawlState, budgetOK func() bool) error {
	staleBefore := time.Now().Add(-r.opt.StaleAfter)
	consec := 0 // fallos seguidos
	saved := 0  // fichas guardadas en esta ejecución

	for {
		refs, err := r.st.DevicesNeedingSpecs(ctx, staleBefore, time.Now().Add(-24*time.Hour), r.opt.Batch)
		if err != nil {
			return err
		}
		if len(refs) == 0 {
			return nil
		}

		for _, d := range refs {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			if r.opt.MaxSpecs > 0 && saved >= r.opt.MaxSpecs {
				return errSpecsLimit
			}
			if !budgetOK() {
				return errBudget
			}

			specs, err := r.c.Specs(ctx, d.Path)
			if err != nil {
				if ctx.Err() != nil {
					return ctx.Err()
				}
				var be *gsmarena.BlockedError
				if errors.As(err, &be) {
					return err
				}
				_ = r.st.MarkSpecsFailed(ctx, d.SourceID, err.Error())
				state.Stats.Failed++

				var se *gsmarena.StatusError
				if errors.As(err, &se) && (se.Status == 404 || se.Status == 410) {
					r.log.Warn("ficha inexistente", "modelo", d.SourceID)
					continue // 404 real, no cuenta como bloqueo
				}
				r.log.Warn("ficha falló", "modelo", d.SourceID, "err", err)
				consec++
				if consec >= r.opt.MaxConsecFails {
					return fmt.Errorf("%w: %v", ErrSoftBlock, err)
				}
				continue
			}

			consec = 0
			if err := r.st.SetDeviceSpecs(ctx, d.SourceID, specs); err != nil {
				return err
			}
			saved++
			state.Stats.Specs++
			if state.Stats.Specs%25 == 0 {
				r.save(state)
				r.log.Info("progreso fichas", "guardadas", state.Stats.Specs, "fallidas", state.Stats.Failed)
			}
		}
	}
}
// syncNewModels compara el total de cada marca en makers.php3 con lo guardado
// y solo recorre las marcas donde el sitio tiene más modelos.
func (r *Crawler) syncNewModels(ctx context.Context, state *store.CrawlState, budgetOK func() bool) error {
	if !budgetOK() {
		return errBudget
	}
	brands, err := r.c.Brands(ctx)
	if err != nil {
		return err
	}
	counts, err := r.st.BrandCounts(ctx)
	if err != nil {
		return err
	}

	for _, b := range brands {
		have := counts[b.FindID]
		if b.DevicesCount <= int(have) {
			continue // sin cambios (o el sitio tiene menos): no se pide nada
		}
		r.log.Info("marca con modelos nuevos", "marca", b.Name, "sitio", b.DevicesCount, "guardados", have)

		path := b.Path
		for path != "" {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			if !budgetOK() {
				return errBudget
			}

			models, next, err := r.c.ModelsPage(ctx, b, path)
			if err != nil {
				var se *gsmarena.StatusError
				if errors.As(err, &se) && (se.Status == 404 || se.Status == 410) {
					break
				}
				return err
			}
			if len(models) == 0 {
				return fmt.Errorf("%w: página vacía de %s (%s)", ErrSoftBlock, b.Name, path)
			}
			if err := r.st.UpsertDevicesBasic(ctx, b, models); err != nil {
				return err
			}

			now, err := r.st.CountBrandDevices(ctx, b.FindID)
			if err != nil {
				return err
			}
			if now > have {
				state.Stats.Devices += int(now - have)
			}
			if now >= int64(b.DevicesCount) || now == have {
				break // ya está al día, o esta página no aportó nada nuevo
			}
			have = now
			path = next
		}
	}
	return nil
}
func (r *Crawler) cooldown(state *store.CrawlState, err error) time.Duration {
	d := r.opt.CooldownBase << uint(min(state.BlockCount-1, 5))
	d = min(d, r.opt.CooldownMax)
	var be *gsmarena.BlockedError
	if errors.As(err, &be) && be.RetryAfter > d {
		d = min(be.RetryAfter, 24*time.Hour)
	}
	return d
}

func (r *Crawler) finish(state *store.CrawlState, runErr error) {
	switch {
	case runErr == nil:
		state.Status = "done"
		state.FinishedAt = time.Now().UTC()
		state.BlockCount = 0
		r.log.Info("ciclo completo", "dispositivos", state.Stats.Devices, "fichas", state.Stats.Specs, "fallidas", state.Stats.Failed)

	case errors.Is(runErr, errBudget), errors.Is(runErr, errPageLimit), errors.Is(runErr, errSpecsLimit):
		// Tope alcanzado: no es un error, se continúa en la próxima ejecución.
		state.Status = "paused"
		state.LastError = runErr.Error()
		r.log.Info("ejecución detenida, se continúa en la próxima",
			"motivo", runErr.Error(), "modelos", state.Stats.Devices, "fichas", state.Stats.Specs)

	case errors.Is(runErr, context.Canceled), errors.Is(runErr, context.DeadlineExceeded):
		state.Status = "paused"
		state.LastError = "interrumpido"
		r.log.Info("crawl interrumpido, el progreso quedó guardado")

	default:
		// bloqueo (429/403, fallos seguidos) o error en el listado: pausa con espera creciente
		state.BlockCount++
		cd := r.cooldown(state, runErr)
		state.Status = "blocked"
		state.BlockedUntil = time.Now().UTC().Add(cd)
		state.LastError = runErr.Error()
		r.log.Warn("crawl pausado", "err", runErr, "reintento_en", cd.String(), "hasta", state.BlockedUntil)
	}
	r.save(state)
} 