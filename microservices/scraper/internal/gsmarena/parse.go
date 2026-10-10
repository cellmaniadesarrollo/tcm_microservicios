package gsmarena

import (
	"context"
	"regexp"
	"strconv"
	"strings"

	"github.com/PuerkitoBio/goquery"
)

type Brand struct {
	ID           int    `json:"id"`
	FindID       string `json:"find_id"`
	Name         string `json:"name"`
	DevicesCount int    `json:"devices_count"`
	Path         string `json:"path"`
}

type Model struct {
	ID          int    `json:"id"`
	FindID      string `json:"find_id"`
	Name        string `json:"name"`
	BrandID     int    `json:"brand_id"`
	ImgURL      string `json:"img_url"`
	Description string `json:"description"`
	Path        string `json:"path"`
}

var (
	trailingID = regexp.MustCompile(`-(\d+)$`)
	digits     = regexp.MustCompile(`\d+`)
)

// "samsung-phones-9.php" -> "samsung-phones-9", 9
func parseFindID(href string) (string, int) {
	findID := strings.TrimSuffix(strings.TrimSuffix(href, ".php3"), ".php")
	id := 0
	if m := trailingID.FindStringSubmatch(findID); m != nil {
		id, _ = strconv.Atoi(m[1])
	}
	return findID, id
}

func (c *Client) Brands(ctx context.Context) ([]Brand, error) {
	doc, err := c.Get(ctx, "makers.php3")
	if err != nil {
		return nil, err
	}

	var out []Brand
	doc.Find("div.st-text table td a").Each(func(_ int, s *goquery.Selection) {
		href, ok := s.Attr("href")
		if !ok {
			return
		}
		spanText := s.Find("span").Text()
		name := strings.TrimSpace(strings.Replace(s.Text(), spanText, "", 1))
		count, _ := strconv.Atoi(digits.FindString(spanText))
		findID, id := parseFindID(href)

		out = append(out, Brand{
			ID: id, FindID: findID, Name: name, DevicesCount: count, Path: href,
		})
	})
	return out, nil
}

// ModelsPage lee UNA sola página de modelos de una marca.
// Devuelve también la ruta de la página siguiente ("" si no hay).
func (c *Client) ModelsPage(ctx context.Context, brand Brand, path string) ([]Model, string, error) {
	doc, err := c.Get(ctx, path)
	if err != nil {
		return nil, "", err
	}

	var out []Model
	doc.Find("div.makers ul li a").Each(func(_ int, s *goquery.Selection) {
		href, _ := s.Attr("href")
		img := s.Find("img")
		src, _ := img.Attr("src")
		desc, _ := img.Attr("title")
		findID, id := parseFindID(href)

		out = append(out, Model{
			ID:          id,
			FindID:      findID,
			Name:        strings.TrimSpace(s.Find("strong span").Text()),
			BrandID:     brand.ID,
			ImgURL:      src,
			Description: strings.TrimSpace(desc),
			Path:        href,
		})
	})

	// El botón "siguiente" ahora es <a class="prevnextbutton" title="Next page">.
	// Se deja el selector antiguo como respaldo por si el sitio vuelve a cambiar.
	next, _ := doc.Find(`a.prevnextbutton[title="Next page"]`).First().Attr("href")
	if next == "" {
		next, _ = doc.Find("a.pages-next").First().Attr("href")
	}
	if next == "#" {
		next = ""
	}
	return out, next, nil
}     