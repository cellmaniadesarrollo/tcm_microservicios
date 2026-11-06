/** Stock disponible de un producto (suma de todos sus lotes y sucursales). */
export const AVAILABLE_SQL = `(COALESCE(sb.on_hand, 0) - COALESCE(sb.reserved, 0))`;

/** Minúsculas y sin tildes en SQL (sin depender de la extensión unaccent). */
export const norm = (expr: string) => `translate(lower(${expr}), 'áéíóúüñ', 'aeiouun')`;

/** Escapa los comodines de LIKE para que "50%" o "a_13" se busquen literalmente. */
export const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

/** El token puede coincidir con la marca, el modelo o el código técnico de algún modelo compatible. */
export const modelSearchSql = (key: string) => `EXISTS (
    SELECT 1 FROM product_models pm
    JOIN models mo ON mo.models_id = pm.model_id
    JOIN brands br ON br.brands_id = mo.models_brands_id
    WHERE pm.product_id = "p"."id"
    AND (
        ${norm('mo.models_name')} LIKE :${key}
        OR ${norm('br.brands_name')} LIKE :${key}
        OR EXISTS (
            SELECT 1 FROM model_technical_codes tc
            WHERE tc.mtc_models_id = mo.models_id AND lower(tc.mtc_code) LIKE :${key}
        )
    )
)`;