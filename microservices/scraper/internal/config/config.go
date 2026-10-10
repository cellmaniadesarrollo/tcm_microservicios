package config

import (
	"os"
	"time"
)

type Config struct {
	Env      string
	HTTPPort string
	MongoURI string
	MongoDB  string

	RabbitURL      string
	RabbitQueue    string
	InternalSecret string

	ScheduleTZ string

	// Los siguientes se calculan solos según APP_ENV (ver más abajo).
	RunOnStart         bool          // scrapear al arrancar el servicio
	ScrapeDelay        time.Duration // pausa base entre peticiones
	MaxRequests        int           // tope de peticiones por ejecución
	MaxPages           int           // páginas de listado por ejecución (0 = todas)
	MaxSpecs           int           // fichas por ejecución (0 = todas)
	RefreshDays        int           // días antes de volver a pedir una ficha
	ListingRefreshDays int           // días antes de volver a recorrer el listado
	CooldownBase       time.Duration // espera tras el primer bloqueo
	CooldownMax        time.Duration // tope de la espera
}

func Load() Config {
	cfg := Config{
		Env:      get("APP_ENV", "development"),
		HTTPPort: get("HTTP_PORT", "8080"),
		MongoURI: get("MONGO_URI", ""),
		MongoDB:  get("MONGO_DB", "tcm_scraping"),

		RabbitURL:      get("RABBIT_URL", ""),
		RabbitQueue:    get("RABBIT_QUEUE", "scraper_models_queue_sync"),
		InternalSecret: get("INTERNAL_SECRET", ""),

		ScheduleTZ: get("SCHEDULE_TZ", "America/Guayaquil"),
	}

	if cfg.Env == "production" {
		// Producción: masivo pero con ritmo suave para que no te baneen.
		cfg.RunOnStart = false
		cfg.ScrapeDelay = 8 * time.Second
		cfg.MaxRequests = 2000
		cfg.MaxPages = 0 // todas las páginas
		cfg.MaxSpecs = 1500
		cfg.RefreshDays = 30
		cfg.ListingRefreshDays = 30
		cfg.CooldownBase = 3 * time.Hour
		cfg.CooldownMax = 12 * time.Hour
	} else {
		// Desarrollo: muy poco, para probar los brokers en cada reinicio.
		cfg.RunOnStart = true
		cfg.ScrapeDelay = 2 * time.Second
		cfg.MaxRequests = 15
		cfg.MaxPages = 1
		cfg.MaxSpecs = 5
		cfg.RefreshDays = 30
		cfg.ListingRefreshDays = 30
		cfg.CooldownBase = 10 * time.Minute
		cfg.CooldownMax = time.Hour
	}

	return cfg
}

// get devuelve la variable de entorno, o el valor por defecto si está vacía.
func get(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}