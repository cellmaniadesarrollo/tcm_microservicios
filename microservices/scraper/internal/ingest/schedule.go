package ingest

import (
	"context"
	"time"

	"github.com/tu-org/tcm-scraper/internal/store"
)

func nextMidnight(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day()+1, 0, 0, 0, 0, t.Location())
}

// shouldResumeNow: true si el último proceso murió o se apagó a mitad de un ciclo.
func (r *Crawler) shouldResumeNow(ctx context.Context) bool {
	st, err := r.st.LoadState(ctx, store.SourceGSMArena)
	if err != nil || st == nil {
		return false
	}
	return st.Status == "running" || (st.Status == "paused" && st.LastError == "interrumpido")
}

// Schedule corre el crawl cada medianoche (en loc) y reintenta cuando vence un bloqueo.
func (r *Crawler) Schedule(ctx context.Context, loc *time.Location, runOnStart bool) {
	// al arrancar: ejecutar si se pidió, o si el proceso anterior quedó a medias
// al arrancar
if runOnStart || r.shouldResumeNow(ctx) {
    st, err := r.st.LoadState(ctx, store.SourceGSMArena)
    // Solo correr si NO estamos bloqueados (o el bloqueo ya venció)
    if err != nil || st == nil || st.Status != "blocked" || time.Now().After(st.BlockedUntil) {
        r.Run(ctx, time.Now().In(loc))
    } else {
        r.log.Info("saltando ejecución al arranque: todavía bloqueado",
            "hasta", st.BlockedUntil.Format(time.RFC3339))
    }
}

	for {
		wake := nextMidnight(time.Now().In(loc))

		if st, err := r.st.LoadState(ctx, store.SourceGSMArena); err == nil && st != nil &&
			st.Status == "blocked" && st.BlockedUntil.Before(wake) {
			wake = st.BlockedUntil
		}

		wait := max(time.Until(wake), time.Second)
		r.log.Info("próxima ejecución", "en", wait.Round(time.Second).String(), "a_las", wake.In(loc).Format(time.RFC3339))

		t := time.NewTimer(wait)
		select {
		case <-ctx.Done():
			t.Stop()
			return
		case <-t.C:
		}
		r.Run(ctx, time.Now().In(loc))
	}
}