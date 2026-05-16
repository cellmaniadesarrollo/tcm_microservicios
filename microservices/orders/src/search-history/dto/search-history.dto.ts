import {
    IsEnum,
    IsInt,
    IsNotEmpty,
    IsString,
    IsUUID,
    MaxLength,
    Min,
} from 'class-validator';
import { SearchType } from '../entities/group-search-history.entity';

// ─── Guardar / hacer upsert ──────────────────────────────────────────────────
export class SaveSearchDto {
    @IsUUID()
    companyId!: string;

    @IsUUID()
    groupId!: string;

    @IsUUID()
    userId!: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(200)
    searchTerm!: string;

    @IsEnum(SearchType)
    searchType!: SearchType;

    /** Solo se persiste si > 0 (búsqueda exitosa) */
    @IsInt()
    @Min(0)
    resultCount!: number;
}

// ─── Leer historial por grupo ────────────────────────────────────────────────
export class GetGroupHistoryDto {
    @IsUUID()
    companyId!: string;

    @IsUUID()
    groupId!: string;

    /** Límite de resultados (default 10, max 20) */
    limit?: number = 10;
}

// ─── Leer historial por usuario (futuro) ────────────────────────────────────
export class GetUserHistoryDto {
    @IsUUID()
    companyId!: string;

    @IsUUID()
    userId!: string;

    limit?: number = 10;
}

// ─── Respuesta del historial ─────────────────────────────────────────────────
export class SearchHistoryItemDto {
    searchTerm!: string;
    searchType!: SearchType;
    resultCount!: number;
    searchedAt!: Date;
}