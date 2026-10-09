package gsmarena

import (
	"context"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"strconv"
	"sync/atomic"
	"time"

	"github.com/PuerkitoBio/goquery"
)

const BaseURL = "https://www.gsmarena.com/"

// BlockedError indica que el sitio nos está limitando o bloqueando (429/403).
type BlockedError struct {
	Status     int
	RetryAfter time.Duration
	URL        string
}

func (e *BlockedError) Error() string {
	return fmt.Sprintf("bloqueado (%d) en %s, retry-after=%s", e.Status, e.URL, e.RetryAfter)
}

// StatusError es una respuesta HTTP inesperada que no es un bloqueo (404, 5xx...).
type StatusError struct {
	Status int
	URL    string
}

func (e *StatusError) Error() string { return fmt.Sprintf("GET %s: status %d", e.URL, e.Status) }

type Client struct {
	http  *http.Client
	delay time.Duration
	reqs  atomic.Int64
}

func NewClient(delay time.Duration) *Client {
	return &Client{
		http:  &http.Client{Timeout: 20 * time.Second},
		delay: delay,
	}
}

// Requests devuelve cuántas peticiones HTTP se han hecho (para el presupuesto).
func (c *Client) Requests() int64 { return c.reqs.Load() }

func sleep(ctx context.Context, d time.Duration) error {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-t.C:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func parseRetryAfter(v string) time.Duration {
	if v == "" {
		return 0
	}
	if secs, err := strconv.Atoi(v); err == nil && secs > 0 {
		return time.Duration(secs) * time.Second
	}
	if t, err := http.ParseTime(v); err == nil {
		if d := time.Until(t); d > 0 {
			return d
		}
	}
	return 0
}

// Get descarga una página. Ante 429 reintenta poco; si persiste (o hay 403)
// devuelve *BlockedError para que el crawler pause en vez de insistir.
func (c *Client) Get(ctx context.Context, path string) (*goquery.Document, error) {
	url := BaseURL + path
	backoff := 30 * time.Second
	const maxAttempts = 3

	for attempt := 1; attempt <= maxAttempts; attempt++ {
		// pausa cortés con jitter: entre delay y 2*delay
		if c.delay > 0 {
			pause := c.delay + time.Duration(rand.Int63n(int64(c.delay)))
			if err := sleep(ctx, pause); err != nil {
				return nil, err
			}
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			return nil, err
		}
		req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36")
		req.Header.Set("Accept-Language", "en-US,en;q=0.9")

		c.reqs.Add(1)
		resp, err := c.http.Do(req)
		if err != nil {
			return nil, err
		}

		switch resp.StatusCode {
		case http.StatusOK:
			doc, err := goquery.NewDocumentFromReader(resp.Body)
			resp.Body.Close()
			return doc, err

		case http.StatusTooManyRequests, http.StatusForbidden:
			ra := parseRetryAfter(resp.Header.Get("Retry-After"))
			_, _ = io.Copy(io.Discard, resp.Body)
			resp.Body.Close()

			if resp.StatusCode == http.StatusForbidden || attempt == maxAttempts || ra > 5*time.Minute {
				return nil, &BlockedError{Status: resp.StatusCode, RetryAfter: ra, URL: url}
			}
			if err := sleep(ctx, max(ra, backoff)); err != nil {
				return nil, err
			}
			backoff *= 2

		default:
			_, _ = io.Copy(io.Discard, resp.Body)
			resp.Body.Close()
			return nil, &StatusError{Status: resp.StatusCode, URL: url}
		}
	}
	return nil, &BlockedError{Status: http.StatusTooManyRequests, URL: url}
}