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

// stillBlocked: true si hay un bloqueo vigente (no conviene pedir nada todavía).
func (r *Crawler) stillBlocked(ctx context.Context) bool {
	st, err := r.st.LoadState(ctx, store.SourceGSMArena)
	if err != nil || st == nil {
		return false
	}
	return st.Status == "blocked" && time.Now().Before(st.BlockedUntil)
}

// Schedule corre el crawl cada medianoche (en loc) y reintenta cuando vence un bloqueo.
func (r *Crawler) Schedule(ctx context.Context, loc *time.Location, runOnStart bool) {
	// Al arrancar: ejecutar si se pidió (desarrollo) o si el proceso anterior quedó a medias.
	if runOnStart || r.shouldResumeNow(ctx) {
		if r.stillBlocked(ctx) {
			r.log.Info("se omite la ejecución al arrancar: todavía en enfriamiento")
		} else {
			r.Run(ctx, time.Now().In(loc))
		}
	}

	for {
		wake := nextMidnight(time.Now().In(loc))

		// Si hay un bloqueo que vence antes de la medianoche, despertar entonces.
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