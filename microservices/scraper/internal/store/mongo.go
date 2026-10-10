package store

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type Store struct {
	client *mongo.Client
	db     *mongo.Database
}

func New(ctx context.Context, uri, dbName string) (*Store, error) {
	client, err := mongo.Connect(
		options.Client().
			ApplyURI(uri).
			SetServerSelectionTimeout(10 * time.Second),
	)
	if err != nil {
		return nil, fmt.Errorf("mongo connect: %w", err)
	}

	pingCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	if err := client.Ping(pingCtx, nil); err != nil {
		_ = client.Disconnect(ctx)
		return nil, fmt.Errorf("mongo ping: %w", err)
	}

	s := &Store{client: client, db: client.Database(dbName)}
	if err := s.ensureIndexes(ctx); err != nil {
		_ = client.Disconnect(ctx)
		return nil, err
	}
	return s, nil
}

func (s *Store) DB() *mongo.Database { return s.db }

func (s *Store) Close(ctx context.Context) error { return s.client.Disconnect(ctx) }

func (s *Store) ensureIndexes(ctx context.Context) error {
	indexes := map[string][]mongo.IndexModel{
		"devices": {
			{Keys: bson.D{{Key: "source", Value: 1}, {Key: "source_id", Value: 1}}, Options: options.Index().SetUnique(true)},
			{Keys: bson.D{{Key: "brand.source_id", Value: 1}}},
			{Keys: bson.D{{Key: "technical_models", Value: 1}}}, // multikey: busca por SM-X940
			{Keys: bson.D{{Key: "name", Value: 1}}},
			{Keys: bson.D{{Key: "specs_scraped_at", Value: 1}, {Key: "numeric_id", Value: -1}}},
			{Keys: bson.D{{Key: "numeric_id", Value: 1}}},
		},
	}
	for coll, models := range indexes {
		if _, err := s.db.Collection(coll).Indexes().CreateMany(ctx, models); err != nil {
			return fmt.Errorf("indexes %s: %w", coll, err)
		}
	}
	return nil
}