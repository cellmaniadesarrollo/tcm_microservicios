package gsmarena

import (
	"context"
	"errors"
	"strings"

	"github.com/PuerkitoBio/goquery"
)

type SpecItem struct {
	SpecID string `json:"spec_id,omitempty" bson:"spec_id,omitempty"`
	Key    string `json:"key" bson:"key"`
	Value  string `json:"value" bson:"value"`
}

type SpecGroup struct {
	Category string     `json:"category" bson:"category"`
	Items    []SpecItem `json:"items" bson:"items"`
}

type ModelSpecs struct {
	Name       string            `json:"name"`
	ImgURL     string            `json:"img_url"`
	Highlights map[string]string `json:"highlights"`
	Groups     []SpecGroup       `json:"groups"`
}

func clean(s string) string {
	return strings.TrimSpace(strings.ReplaceAll(s, "\u00a0", " "))
}

func (c *Client) Specs(ctx context.Context, path string) (*ModelSpecs, error) {
	doc, err := c.Get(ctx, path)
	if err != nil {
		return nil, err
	}

	out := &ModelSpecs{
		Name:       clean(doc.Find("h1.specs-phone-name-title").Text()),
		Highlights: map[string]string{},
	}

	if src, ok := doc.Find(".specs-photo-main img").First().Attr("src"); ok {
		out.ImgURL = src
	}

	// resumen rápido: released-hl, displaysize-hl, ramsize-hl, chipset-hl, etc.
	doc.Find("[data-spec$='-hl']").Each(func(_ int, s *goquery.Selection) {
		id, _ := s.Attr("data-spec")
		if v := clean(s.Text()); v != "" {
			out.Highlights[strings.TrimSuffix(id, "-hl")] = v
		}
	})

	doc.Find("#specs-list table").Each(func(_ int, t *goquery.Selection) {
		group := SpecGroup{Category: clean(t.Find("th").First().Text())}

		t.Find("tr").Each(func(_ int, tr *goquery.Selection) {
			key := clean(tr.Find("td.ttl").Text())
			nfo := tr.Find("td.nfo")
			val := clean(nfo.Text())
			if val == "" {
				return
			}
			// fila sin título = continuación del campo anterior
			if key == "" && len(group.Items) > 0 {
				last := &group.Items[len(group.Items)-1]
				last.Value += "\n" + val
				return
			}
			specID, _ := nfo.Attr("data-spec")
			group.Items = append(group.Items, SpecItem{SpecID: specID, Key: key, Value: val})
		})

		if group.Category != "" && len(group.Items) > 0 {
			out.Groups = append(out.Groups, group)
		}
	})

	if len(out.Groups) == 0 {
		return nil, errors.New("ficha sin especificaciones (¿bloqueo o cambio de HTML?): " + path)
	}
	return out, nil
}