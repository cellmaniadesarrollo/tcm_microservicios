package store

import (
	"context"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type ModelBrand struct {
	ID       int64  `bson:"id"        json:"id"`
	SourceID string `bson:"source_id" json:"sourceId"`
	Name     string `bson:"name"      json:"name"`
}

// ModelRow es un dispositivo del listado. No exige ficha descargada.
type ModelRow struct {
	NumericID   int64      `bson:"numeric_id"  json:"numericId"`
	SourceID    string     `bson:"source_id"   json:"sourceId"`
	Name        string     `bson:"name"        json:"name"`
	ImgURL      string     `bson:"img_url"     json:"imgUrl"`
	Description string     `bson:"description" json:"description"`
	Brand       ModelBrand `bson:"brand"       json:"brand"`
}

// ListModels devuelve dispositivos paginados por cursor (numeric_id ascendente).
func (s *Store) ListModels(ctx context.Context, afterNumericID int64, limit int64) ([]ModelRow, error) {
	filter := bson.M{
		"source":     SourceGSMArena,
		"numeric_id": bson.M{"$gt": afterNumericID},
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "numeric_id", Value: 1}}).
		SetLimit(limit).
		SetProjection(bson.M{
			"numeric_id": 1, "source_id": 1, "name": 1,
			"img_url": 1, "description": 1,
			"brand.id": 1, "brand.source_id": 1, "brand.name": 1,
		})

	cur, err := s.db.Collection("devices").Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	var rows []ModelRow
	if err := cur.All(ctx, &rows); err != nil {
		return nil, err
	}
	return rows, nil
}