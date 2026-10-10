package store

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// Ajusta los nombres bson a como guardas realmente los documentos (gsmarena.go).
type TechnicalModelRow struct {
	NumericID       int64      `bson:"numeric_id"       json:"numericId"`
	SourceID        string     `bson:"source_id"        json:"sourceId"`
	Name            string     `bson:"name"             json:"name"`
	Brand           struct {
		SourceID string `bson:"source_id" json:"sourceId"`
		Name     string `bson:"name"      json:"name"`
	} `bson:"brand" json:"brand"`
	TechnicalModels []string   `bson:"technical_models" json:"technicalModels"`
	SpecsScrapedAt  *time.Time `bson:"specs_scraped_at" json:"specsScrapedAt"`
}

func (s *Store) ListTechnicalModels(
	ctx context.Context, afterNumericID int64, since *time.Time, limit int64,
) ([]TechnicalModelRow, error) {
	filter := bson.M{
	"source":                SourceGSMArena,
	"numeric_id":            bson.M{"$gt": afterNumericID},
	"technical_models.0":    bson.M{"$exists": true},
	}
if since != nil {
	filter["specs_scraped_at"] = bson.M{"$gte": *since}
}

	opts := options.Find().
		SetSort(bson.D{{Key: "numeric_id", Value: 1}}).
		SetLimit(limit).
		SetProjection(bson.M{
			"numeric_id": 1, "source_id": 1, "name": 1,
			"brand.source_id": 1, "brand.name": 1,
			"technical_models": 1, "specs_scraped_at": 1,
		})

	cur, err := s.db.Collection("devices").Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	var rows []TechnicalModelRow
	if err := cur.All(ctx, &rows); err != nil {
		return nil, err
	}
	return rows, nil
}