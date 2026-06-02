import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GroupSearchHistory } from './entities/group-search-history.entity';
import { GroupCache } from '../users-employees-events/entities/group_cache.entity';
import {
    GetGroupHistoryDto,
    GetUserHistoryDto,
    SearchHistoryItemDto,
} from './dto/search-history.dto';

const MAX_LIMIT = 20;
const IS_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class SearchHistoryService {
    private readonly logger = new Logger(SearchHistoryService.name);

    constructor(
        @InjectRepository(GroupSearchHistory)
        private readonly repo: Repository<GroupSearchHistory>,

        @InjectRepository(GroupCache)
        private readonly groupCacheRepo: Repository<GroupCache>,
    ) { }

    /**
     * Punto de entrada principal desde listOrders.
     *
     * Reglas:
     *  - Ignora si search es UUID (escaneo QR, no búsqueda manual)
     *  - Ignora si no hubo resultados
     *  - Guarda / actualiza en TODOS los grupos del usuario
     */
    async saveFromSearch(params: {
        companyId: string;
        userId: string;
        searchTerm: string;
        resultCount: number;
        searchType?: string;
    }): Promise<void> {
        const { companyId, userId, searchTerm, resultCount, searchType = 'order' } = params;
        console.log(params)
        // ── No guardar escaneos QR ───────────────────────────────────────────────
        if (IS_UUID.test(searchTerm.trim())) return;

        // ── Solo búsquedas exitosas ──────────────────────────────────────────────
        if (resultCount <= 0) return;

        // ── Obtener todos los grupos del usuario ─────────────────────────────────
        const groups = await this.groupCacheRepo.find({
            where: { employee: { id: userId } },
            select: ['id'],
        });

        if (!groups.length) return;

        // ── Upsert en paralelo para cada grupo ───────────────────────────────────
        await Promise.all(
            groups.map((group) =>
                this.repo
                    .createQueryBuilder()
                    .insert()
                    .into(GroupSearchHistory)
                    .values({
                        companyId,
                        groupId: group.id,
                        userId,
                        searchTerm: searchTerm.trim(),
                        searchType: searchType as any,
                        resultCount,
                        searchedAt: new Date(),
                    })
                    .orUpdate(
                        ['result_count', 'searched_at', 'user_id'],
                        ['company_id', 'group_id', 'user_id', 'search_term', 'search_type'],
                    )
                    .execute(),
            ),
        );
    }

    // ── Lectura: por grupo (dropdown actual) ────────────────────────────────────
    async getByGroup(dto: GetGroupHistoryDto): Promise<SearchHistoryItemDto[]> {
        const limit = Math.min(dto.limit ?? 10, MAX_LIMIT);
        return this.repo.find({
            where: { companyId: dto.companyId, groupId: dto.groupId },
            order: { searchedAt: 'DESC' },
            take: limit,
            select: ['searchTerm', 'searchType', 'resultCount', 'searchedAt'],
        });
    }

    // ── Lectura: por usuario (modo futuro) ──────────────────────────────────────
    async getByUser(dto: GetUserHistoryDto): Promise<SearchHistoryItemDto[]> {
        const limit = Math.min(dto.limit ?? 10, MAX_LIMIT);
        return this.repo.find({
            where: { companyId: dto.companyId, userId: dto.userId },
            order: { searchedAt: 'DESC' },
            take: limit,
            select: ['searchTerm', 'searchType', 'resultCount', 'searchedAt'],
        });
    }

    async pruneGroup(companyId: string, groupId: string, keep = 20): Promise<void> {
        const toKeep = await this.repo.find({
            where: { companyId, groupId },
            order: { searchedAt: 'DESC' },
            take: keep,
            select: ['id'],
        });
        if (toKeep.length < keep) return;
        const keepIds = toKeep.map((r) => r.id);
        await this.repo
            .createQueryBuilder()
            .delete()
            .where('company_id = :companyId AND group_id = :groupId', { companyId, groupId })
            .andWhere('id NOT IN (:...keepIds)', { keepIds })
            .execute();
    }


    // Agregar en search-history.service.ts
    // (dentro de la clase SearchHistoryService, después de getByUser)

    /**
     * Últimos 20 términos buscados por el usuario,
     * combinados entre todos los grupos a los que pertenece.
     *
     * Si buscó "ORD-001" en cashiers y technicians, aparece una sola vez
     * (la más reciente). Si buscó "ORD-002" solo en cashiers, aparece con
     * su grupo correspondiente.
     *
     * Retorna: [{ searchTerm, groupName }]
     */
    async getRecentByUser(params: {
        userId: string;
        companyId: string;
    }): Promise<{ searchTerm: string; groupName: string }[]> {
        const { userId, companyId } = params;

        // Trae los grupos del usuario para poder hacer JOIN
        const groups = await this.groupCacheRepo.find({
            where: { employee: { id: userId } },
            select: ['id'],
        });

        if (!groups.length) return [];

        const groupIds = groups.map((g) => g.id);

        /**
         * Query: de todos los grupos del usuario, los 20 registros
         * más recientes. Se usa DISTINCT ON (search_term) para que
         * el mismo término no aparezca dos veces aunque esté en
         * varios grupos — queda con el grupo donde se buscó más
         * recientemente.
         *
         * Si prefieres verlo en TODOS los grupos (sin dedup),
         * quita el DISTINCT ON y el primer ORDER BY search_term.
         */
        const rows = await this.repo
            .createQueryBuilder('h')
            .innerJoin('h.group', 'g')       // JOIN con group_cache para traer group_name
            .select([
                'DISTINCT ON (h.search_term) h.search_term AS "searchTerm"',
                'g.group_name                              AS "groupName"',
                'h.searched_at                             AS "searchedAt"',  // solo para ordenar
            ])
            .where('h.company_id = :companyId', { companyId })
            .andWhere('h.user_id  = :userId', { userId })
            .andWhere('h.group_id IN (:...groupIds)', { groupIds })
            .orderBy('h.search_term', 'ASC')   // requerido por DISTINCT ON
            .addOrderBy('h.searched_at', 'DESC')
            .limit(5)
            .getRawMany<{ searchTerm: string; groupName: string; searchedAt: Date }>();

        // Reordenar por fecha descendente (DISTINCT ON necesitó el ORDER BY previo)
        return rows
            .sort((a, b) => b.searchedAt.getTime() - a.searchedAt.getTime())
            .map(({ searchTerm, groupName }) => ({ searchTerm, groupName }));
    }
}