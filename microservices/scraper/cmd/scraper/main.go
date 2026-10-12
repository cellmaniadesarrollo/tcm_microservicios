package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
	_ "time/tzdata" // zonas horarias dentro del binario (imágenes Docker mínimas)

	"github.com/tu-org/tcm-scraper/internal/config"
	"github.com/tu-org/tcm-scraper/internal/events" // NUEVO
	"github.com/tu-org/tcm-scraper/internal/gsmarena"
	"github.com/tu-org/tcm-scraper/internal/ingest"
	"github.com/tu-org/tcm-scraper/internal/messaging"
	"github.com/tu-org/tcm-scraper/internal/store"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	cfg := config.Load()

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	loc, err := time.LoadLocation(cfg.ScheduleTZ)
	if err != nil {
		log.Error("zona horaria inválida", "tz", cfg.ScheduleTZ, "err", err)
		os.Exit(1)
	}

	st, err := store.New(ctx, cfg.MongoURI, cfg.MongoDB)
	if err != nil {
		log.Error("no se pudo iniciar mongo", "err", err)
		os.Exit(1)
	}
	log.Info("mongo conectado", "db", cfg.MongoDB)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})

	srv := &http.Server{
		Addr:              ":" + cfg.HTTPPort,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		log.Info("scraper iniciado", "port", cfg.HTTPPort, "env", cfg.Env)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Error("error en servidor", "err", err)
			stop()
		}
	}()

	// NUEVO: publisher de Kafka (tiempo real)
	pub := events.NewPublisher(cfg.KafkaBrokers, log)

	gs := gsmarena.NewClient(cfg.ScrapeDelay)
	crawler := ingest.NewCrawler(gs, st, log, ingest.Options{
		StaleAfter:   time.Duration(cfg.RefreshDays) * 24 * time.Hour,
		MaxRequests:  cfg.MaxRequests,
		CooldownBase: cfg.CooldownBase,
		CooldownMax:  cfg.CooldownMax,
		Pub:          pub, // NUEVO
	})

	consumer := messaging.NewConsumer(cfg.RabbitURL, cfg.RabbitQueue)
	consumer.Handle("sync_technical_models", messaging.TechnicalModelsHandler(st, cfg.InternalSecret))
	consumer.Handle("sync_models", messaging.ModelsHandler(st, cfg.InternalSecret))

	consumerDone := make(chan struct{})
	go func() {
		defer close(consumerDone)
		consumer.Run(ctx)
	}()

	crawlDone := make(chan struct{})
	go func() {
		defer close(crawlDone)
		crawler.Schedule(ctx, loc, cfg.RunOnStart)
	}()

	<-ctx.Done()
	log.Info("apagando...")

	select {
	case <-crawlDone:
	case <-time.After(15 * time.Second):
		log.Warn("el crawler no terminó a tiempo")
	}

	select {
	case <-consumerDone:
	case <-time.After(5 * time.Second):
		log.Warn("el consumer no terminó a tiempo")
	}

	pub.Close() // NUEVO: después del crawler, que es quien publica

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdownCtx)
	_ = st.Close(shutdownCtx)
}