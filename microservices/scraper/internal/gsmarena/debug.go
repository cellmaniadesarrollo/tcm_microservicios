package gsmarena

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
)

// DebugFirstPage imprime marcas y la primera página de modelos de una marca.
// No guarda nada.
func DebugFirstPage(ctx context.Context, c *Client, log *slog.Logger, brandName string) {
	brands, err := c.Brands(ctx)
	if err != nil {
		log.Error("debug: brands", "err", err)
		return
	}
	log.Info("debug: marcas encontradas", "total", len(brands))
	printJSON("PRIMERAS 5 MARCAS", brands[:min(5, len(brands))])

	// buscar la marca pedida (o la primera si no aparece)
	brand := brands[0]
	for _, b := range brands {
		if strings.EqualFold(b.Name, brandName) {
			brand = b
			break
		}
	}

	models, next, err := c.ModelsPage(ctx, brand, brand.Path)
	if err != nil {
		log.Error("debug: models", "err", err)
		return
	}
	log.Info("debug: modelos en la primera página",
		"marca", brand.Name, "total_pagina", len(models), "hay_siguiente", next != "")
	printJSON("PRIMEROS 5 MODELOS DE "+brand.Name, models[:min(5, len(models))])

		if len(models) == 0 {
		return
	}
	specs, err := c.Specs(ctx, models[0].Path)
	if err != nil {
		log.Error("debug: specs", "err", err)
		return
	}
	log.Info("debug: specs leídas", "modelo", models[0].Name, "grupos", len(specs.Groups))
	printJSON("FICHA TÉCNICA DE "+models[0].Name, specs)
}

func printJSON(title string, v any) {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	enc.SetIndent("", "  ")
	_ = enc.Encode(v)
	fmt.Printf("\n===== %s =====\n%s\n", title, buf.String())
}