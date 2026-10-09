package messaging

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"time"

	"github.com/tu-org/tcm-scraper/internal/store"
)

type syncRequest struct {
	InternalToken string     `json:"internalToken"`
	After         int64      `json:"after"`           // cursor: último numericId recibido
	Since         *time.Time `json:"since,omitempty"` // opcional: sync incremental
	Limit         int64      `json:"limit"`
}

type syncResponse struct {
	Items      []store.TechnicalModelRow `json:"items"`
	NextCursor int64                     `json:"nextCursor"`
	HasMore    bool                      `json:"hasMore"`
}

func TechnicalModelsHandler(st *store.Store, secret string) Handler {
	return func(ctx context.Context, data json.RawMessage) (any, error) {
		var req syncRequest
		if err := json.Unmarshal(data, &req); err != nil {
			return nil, errors.New("bad payload")
		}
		if secret == "" || subtle.ConstantTimeCompare([]byte(req.InternalToken), []byte(secret)) != 1 {
			return nil, errors.New("unauthorized")
		}
		if req.Limit <= 0 || req.Limit > 1000 {
			req.Limit = 500
		}

		// pedimos limit+1 para saber si hay más páginas
		rows, err := st.ListTechnicalModels(ctx, req.After, req.Since, req.Limit+1)
		if err != nil {
			return nil, err
		}
		hasMore := int64(len(rows)) > req.Limit
		if hasMore {
			rows = rows[:req.Limit]
		}
		next := req.After
		if len(rows) > 0 {
			next = rows[len(rows)-1].NumericID
		}
		if rows == nil {
			rows = []store.TechnicalModelRow{}
		}
		return syncResponse{Items: rows, NextCursor: next, HasMore: hasMore}, nil
	}
}