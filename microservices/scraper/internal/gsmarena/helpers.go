package gsmarena

import "strings"

// Value busca un valor por categoría y clave (sin distinguir mayúsculas).
func (s *ModelSpecs) Value(category, key string) string {
	for _, g := range s.Groups {
		if !strings.EqualFold(g.Category, category) {
			continue
		}
		for _, it := range g.Items {
			if strings.EqualFold(it.Key, key) {
				return it.Value
			}
		}
	}
	return ""
}

// TechnicalModels devuelve los códigos de "Misc > Models" (SM-X940, SM-X946...).
func (s *ModelSpecs) TechnicalModels() []string {
	raw := s.Value("Misc", "Models")
	parts := strings.FieldsFunc(raw, func(r rune) bool {
		return r == ',' || r == ';' || r == '\n'
	})
	out := make([]string, 0, len(parts))
	seen := map[string]bool{}
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" && !seen[p] {
			seen[p] = true
			out = append(out, p)
		}
	}
	return out
}