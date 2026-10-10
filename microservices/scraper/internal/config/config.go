package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	Env      string
	HTTPPort string
	MongoURI string
	MongoDB  string

	ScheduleTZ   string
	RunOnStart   bool
	ScrapeDelay  time.Duration
	MaxRequests  int
	RefreshDays  int
	CooldownBase time.Duration
	CooldownMax  time.Duration

	RabbitURL      string
	InternalSecret string
	RabbitQueue    string
}

func Load() Config {
	return Config{
		Env:      get("APP_ENV", "development"),
		HTTPPort: get("HTTP_PORT", "8080"),
		MongoURI: get("MONGO_URI", ""),
		MongoDB:  get("MONGO_DB", "tcm_scraping"),

		ScheduleTZ:   get("SCHEDULE_TZ", "America/Guayaquil"),
		RunOnStart:   getBool("RUN_ON_START", false),
		ScrapeDelay:  getDuration("SCRAPE_DELAY", 5*time.Second),
		MaxRequests:  getInt("MAX_REQUESTS", 5000),
		RefreshDays:  getInt("REFRESH_DAYS", 30),
		CooldownBase: getDuration("COOLDOWN_BASE", time.Hour),
		CooldownMax:  getDuration("COOLDOWN_MAX", 12*time.Hour),

		RabbitURL:      get("RABBIT_URL", ""),
		InternalSecret: get("INTERNAL_SECRET", ""),
		RabbitQueue:    get("RABBIT_QUEUE", "scraper_models_queue_sync"),
	}
}

func get(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getInt(key string, fallback int) int {
	if v, err := strconv.Atoi(os.Getenv(key)); err == nil {
		return v
	}
	return fallback
}

func getBool(key string, fallback bool) bool {
	if v, err := strconv.ParseBool(os.Getenv(key)); err == nil {
		return v
	}
	return fallback
}

func getDuration(key string, fallback time.Duration) time.Duration {
	if v, err := time.ParseDuration(os.Getenv(key)); err == nil {
		return v 
	}
	return fallback
} 