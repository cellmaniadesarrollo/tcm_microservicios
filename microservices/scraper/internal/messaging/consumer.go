package messaging

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)

type Handler func(ctx context.Context, data json.RawMessage) (any, error)

type Consumer struct {
	url      string
	queue    string
	handlers map[string]Handler
}

func NewConsumer(url, queue string) *Consumer {
	return &Consumer{url: url, queue: queue, handlers: map[string]Handler{}}
}

// cmd coincide con { cmd: '...' } del lado de Nest.
func (c *Consumer) Handle(cmd string, h Handler) { c.handlers[cmd] = h }

type nestRequest struct {
	Pattern struct {
		Cmd string `json:"cmd"`
	} `json:"pattern"`
	Data json.RawMessage `json:"data"`
	ID   string          `json:"id"`
}

type nestResponse struct {
	Err        any  `json:"err,omitempty"`
	Response   any  `json:"response"`
	IsDisposed bool `json:"isDisposed"`
}

// Run bloquea y se reconecta solo si Rabbit cae o aún no arrancó.
func (c *Consumer) Run(ctx context.Context) {
	for {
		err := c.runOnce(ctx)
		if ctx.Err() != nil {
			return
		}
		log.Printf("rabbit: %v — reintentando en 5s", err)
		select {
		case <-ctx.Done():
			return
		case <-time.After(5 * time.Second):
		}
	}
}

func (c *Consumer) runOnce(ctx context.Context) error {
	conn, err := amqp.Dial(c.url)
	if err != nil {
		return fmt.Errorf("dial: %w", err)
	}
	defer conn.Close()

	ch, err := conn.Channel()
	if err != nil {
		return fmt.Errorf("channel: %w", err)
	}
	defer ch.Close()

	// Mismos parámetros que en Nest: durable, sin args extra.
	if _, err := ch.QueueDeclare(c.queue, true, false, false, false, nil); err != nil {
		return fmt.Errorf("queue declare: %w", err)
	}
	if err := ch.Qos(1, 0, false); err != nil {
		return err
	}
	msgs, err := ch.Consume(c.queue, "", false, false, false, false, nil)
	if err != nil {
		return fmt.Errorf("consume: %w", err)
	}

	closed := conn.NotifyClose(make(chan *amqp.Error, 1))
	log.Printf("🐇 escuchando cola %q", c.queue)

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case e := <-closed:
			return fmt.Errorf("conexión cerrada: %v", e)
		case d, ok := <-msgs:
			if !ok {
				return errors.New("consumo cerrado")
			}
			c.dispatch(ctx, ch, d)
		}
	}
}

func (c *Consumer) dispatch(ctx context.Context, ch *amqp.Channel, d amqp.Delivery) {
	defer d.Ack(false) // siempre se ackea: el error viaja en la respuesta

	var req nestRequest
	if err := json.Unmarshal(d.Body, &req); err != nil {
		c.reply(ctx, ch, d, nestResponse{Err: "invalid message", IsDisposed: true})
		return
	}

	h, ok := c.handlers[req.Pattern.Cmd]
	if !ok {
		c.reply(ctx, ch, d, nestResponse{Err: "unknown cmd: " + req.Pattern.Cmd, IsDisposed: true})
		return
	}

	res, err := c.safeCall(ctx, h, req.Data)
	if err != nil {
		log.Printf("handler %s: %v", req.Pattern.Cmd, err)
		c.reply(ctx, ch, d, nestResponse{Err: err.Error(), IsDisposed: true})
		return
	}
	c.reply(ctx, ch, d, nestResponse{Response: res, IsDisposed: true})
}

func (c *Consumer) safeCall(ctx context.Context, h Handler, data json.RawMessage) (res any, err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("panic: %v", r)
		}
	}()
	hctx, cancel := context.WithTimeout(ctx, 60*time.Second)
	defer cancel()
	return h(hctx, data)
}

func (c *Consumer) reply(ctx context.Context, ch *amqp.Channel, d amqp.Delivery, r nestResponse) {
	if d.ReplyTo == "" { // era un emit() (evento), no espera respuesta
		return
	}
	body, err := json.Marshal(r)
	if err != nil {
		body = []byte(`{"err":"marshal error","isDisposed":true}`)
	}
	pctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	err = ch.PublishWithContext(pctx, "", d.ReplyTo, false, false, amqp.Publishing{
		ContentType:   "application/json",
		CorrelationId: d.CorrelationId,
		Body:          body,
	})
	if err != nil {
		log.Printf("reply publish: %v", err)
	}
} 