package store

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"github.com/tu-org/tcm-scraper/internal/gsmarena"
)

const SourceGSMArena = "gsmarena"

func deviceFilter(sourceID string) bson.D {
	return bson.D{
		{Key: "source", Value: SourceGSMArena},
		{Key: "source_id", Value: sourceID},
	}
}

// UpsertDevicesBasic guarda en lote los datos del listado sin tocar la ficha ya guardada.
func (s *Store) UpsertDevicesBasic(ctx context.Context, brand gsmarena.Brand, models []gsmarena.Model) error {
	if len(models) == 0 {
		return nil
	}
	now := time.Now().UTC()
	ops := make([]mongo.WriteModel, 0, len(models))
	for _, m := range models {
		set := bson.D{
			{Key: "numeric_id", Value: m.ID},
			{Key: "brand", Value: bson.D{
				{Key: "id", Value: brand.ID},
				{Key: "source_id", Value: brand.FindID},
				{Key: "name", Value: brand.Name},
			}},
			{Key: "name", Value: m.Name},
			{Key: "img_url", Value: m.ImgURL},
			{Key: "description", Value: m.Description},
			{Key: "path", Value: m.Path},
			{Key: "updated_at", Value: now},
		}
		ops = append(ops, mongo.NewUpdateOneModel().
			SetFilter(deviceFilter(m.FindID)).
			SetUpdate(bson.D{
				{Key: "$set", Value: set},
				{Key: "$setOnInsert", Value: bson.D{{Key: "created_at", Value: now}}},
			}).
			SetUpsert(true))
	}
	if _, err := s.db.Collection("devices").BulkWrite(ctx, ops, options.BulkWrite().SetOrdered(false)); err != nil {
		return fmt.Errorf("bulk upsert devices (%s): %w", brand.FindID, err)
	}
	return nil
}

// SetDeviceSpecs guarda la ficha completa de un dispositivo ya listado.
func (s *Store) SetDeviceSpecs(ctx context.Context, sourceID string, sp *gsmarena.ModelSpecs) error {
	now := time.Now().UTC()
	_, err := s.db.Collection("devices").UpdateOne(ctx, deviceFilter(sourceID), bson.D{
		{Key: "$set", Value: bson.D{
			{Key: "full_name", Value: sp.Name},
			{Key: "technical_models", Value: sp.TechnicalModels()},
			{Key: "announced", Value: sp.Value("Launch", "Announced")},
			{Key: "status", Value: sp.Value("Launch", "Status")},
			{Key: "price", Value: sp.Value("Misc", "Price")},
			{Key: "colors", Value: sp.Value("Misc", "Colors")},
			{Key: "highlights", Value: sp.Highlights},
			{Key: "groups", Value: sp.Groups},
			{Key: "specs_scraped_at", Value: now},
			{Key: "updated_at", Value: now},
		}},
		{Key: "$unset", Value: bson.D{
			{Key: "specs_failed_at", Value: ""},
			{Key: "specs_error", Value: ""},
		}},
	})
	if err != nil {
		return fmt.Errorf("set specs %s: %w", sourceID, err)
	}
	return nil
}

// MarkSpecsFailed evita que un dispositivo problemático bloquee la cola;
// se vuelve a intentar pasadas 24 h.
func (s *Store) MarkSpecsFailed(ctx context.Context, sourceID, reason string) error {
	_, err := s.db.Collection("devices").UpdateOne(ctx, deviceFilter(sourceID), bson.D{
		{Key: "$set", Value: bson.D{
			{Key: "specs_failed_at", Value: time.Now().UTC()},
			{Key: "specs_error", Value: reason},
		}},
	})
	return err
}

type DeviceRef struct {
	SourceID string `bson:"source_id"`
	Name     string `bson:"name"`
	Path     string `bson:"path"`
}

// DevicesNeedingSpecs devuelve la cola de fichas pendientes: primero las que
// nunca se descargaron, luego las más viejas que staleBefore.
func (s *Store) DevicesNeedingSpecs(ctx context.Context, staleBefore, retryFailedBefore time.Time, limit int) ([]DeviceRef, error) {
	filter := bson.D{
		{Key: "source", Value: SourceGSMArena},
		{Key: "$and", Value: bson.A{
			bson.D{{Key: "$or", Value: bson.A{
				bson.D{{Key: "specs_scraped_at", Value: bson.D{{Key: "$exists", Value: false}}}},
				bson.D{{Key: "specs_scraped_at", Value: bson.D{{Key: "$lt", Value: staleBefore}}}},
			}}},
			bson.D{{Key: "$or", Value: bson.A{
				bson.D{{Key: "specs_failed_at", Value: bson.D{{Key: "$exists", Value: false}}}},
				bson.D{{Key: "specs_failed_at", Value: bson.D{{Key: "$lt", Value: retryFailedBefore}}}},
			}}},
		}},
	}

	cur, err := s.db.Collection("devices").Find(ctx, filter,
		options.Find().
			SetSort(bson.D{{Key: "specs_scraped_at", Value: 1}, {Key: "numeric_id", Value: -1}}).
			SetLimit(int64(limit)).
			SetProjection(bson.D{
				{Key: "source_id", Value: 1},
				{Key: "name", Value: 1},
				{Key: "path", Value: 1},
			}))
	if err != nil {
		return nil, err
	}
	var out []DeviceRef
	if err := cur.All(ctx, &out); err != nil {
		return nil, err
	}
	return out, nil
}