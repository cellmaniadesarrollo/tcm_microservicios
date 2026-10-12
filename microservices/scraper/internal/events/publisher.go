package events

import (
	"context"
	"encoding/json"
	"log/slog"
	"strings"
	"time"

	"github.com/segmentio/kafka-go"
)

const (
	TopicModelCreated     = "ms.catalog.model.created"
	TopicModelTechnicalUp = "ms.catalog.model.technical.updated"
)

type Envelope struct {
	EventType  string    `json:"eventType"`
	OccurredAt time.Time `json:"occurredAt"`
	Source     string    `json:"source"`
	Data       any       `json:"data"`
}

type BrandPayload struct {
	ID       int64  `json:"id"`
	SourceID string `json:"sourceId"`
	Name     string `json:"name"`
}

type ModelCreated struct {
	NumericID   int64        `json:"numericId"`
	SourceID    string       `json:"sourceId"`
	Name        string       `json:"name"`
	ImgURL      string       `json:"imgUrl"`
	Description string       `json:"description"`
	Brand       BrandPayload `json:"brand"`
}

type ModelTechnical struct {
	SourceID        string   `json:"sourceId"`
	TechnicalModels []string `json:"technicalModels"`
}

// Publisher es seguro de usar aunque sea nil o esté desactivado.
type Publisher struct {
	w   *kafka.Writer
	log *slog.Logger
}

func NewPublisher(brokers string, log *slog.Logger) *Publisher {
	p := &Publisher{log: log}
	if strings.TrimSpace(brokers) == "" {
		log.Warn("kafka desactivado: KAFKA_BOOTSTRAP_SERVERS vacío")
		return p
	}
	p.w = &kafka.Writer{
		Addr:                   kafka.TCP(strings.Split(brokers, ",")...),
		Balancer:               &kafka.Hash{}, // misma key -> misma partición
		RequiredAcks:           kafka.RequireOne,
		BatchTimeout:           50 * time.Millisecond,
		WriteTimeout:           10 * time.Second,
		AllowAutoTopicCreation: false, // los topics los crea init-kafka
	}
	log.Info("kafka publisher listo", "brokers", brokers)
	return p
}

// Publish nunca devuelve error al llamador: lo registra y sigue.
func (p *Publisher) Publish(ctx context.Context, topic, key, eventType string, data any) {
	if p == nil || p.w == nil {
		return
	}
	body, err := json.Marshal(Envelope{
		EventType:  eventType,
		OccurredAt: time.Now().UTC(),
		Source:     "ms-scraper",
		Data:       data,
	})
	if err != nil {
		p.log.Error("kafka marshal", "topic", topic, "err", err)
		return
	}
	pctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	if err := p.w.WriteMessages(pctx, kafka.Message{Topic: topic, Key: []byte(key), Value: body}); err != nil {
		p.log.Error("kafka publish", "topic", topic, "key", key, "err", err)
	}
}

func (p *Publisher) Close() {
	if p != nil && p.w != nil {
		_ = p.w.Close()
	}
}