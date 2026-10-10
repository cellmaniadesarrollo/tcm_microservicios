package store

import (
	"context"
	"errors"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type CrawlStats struct {
	Devices int `bson:"devices"`
	Specs   int `bson:"specs"`
	Failed  int `bson:"failed"`
}

// CrawlState es el único documento de control del crawl (colección crawl_state).
type CrawlState struct {
	ID            string     `bson:"_id"`
	Status        string     `bson:"status"` // running | paused | blocked | done
	RunDay        string     `bson:"run_day"`
	StartedAt     time.Time  `bson:"started_at"`
	FinishedAt    time.Time  `bson:"finished_at"`
	BlockedUntil  time.Time  `bson:"blocked_until"`
	BlockCount    int        `bson:"block_count"`
	ListingDone   bool       `bson:"listing_done"`
	DoneBrands    []string   `bson:"done_brands"`
	BrandSourceID string     `bson:"brand_source_id"`
	NextPath      string     `bson:"next_path"`
	Stats         CrawlStats `bson:"stats"`
	LastError     string     `bson:"last_error"`
}

func (s *Store) LoadState(ctx context.Context, id string) (*CrawlState, error) {
	var st CrawlState
	err := s.db.Collection("crawl_state").FindOne(ctx, bson.D{{Key: "_id", Value: id}}).Decode(&st)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &st, nil
}

func (s *Store) SaveState(ctx context.Context, st *CrawlState) error {
	_, err := s.db.Collection("crawl_state").ReplaceOne(ctx,
		bson.D{{Key: "_id", Value: st.ID}}, st,
		options.Replace().SetUpsert(true))
	return err
}