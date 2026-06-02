import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { SearchHistoryService } from './search-history.service';

@Controller('search-history')
export class SearchHistoryController {
    constructor(private readonly searchHistoryService: SearchHistoryService) {

    }
    @MessagePattern({ cmd: 'get_search_history' })
    getSearchHistory(
        @Payload() payload: { user: { userId: string; companyId: string } },
    ) {
        return this.searchHistoryService.getRecentByUser({
            userId: payload.user.userId,
            companyId: payload.user.companyId,
        });
    }

    @MessagePattern({ cmd: 'save_search_history' })
    saveSearchHistory(
        @Payload() payload: {
            user: { userId: string; companyId: string };
            dto: any;
        },
    ) {
        console.log(payload)
        const { user, dto } = payload;
        return this.searchHistoryService.saveFromSearch({
            companyId: user.companyId,
            userId: user.userId,
            searchTerm: dto.searchTerm,
            resultCount: dto.resultCount,
            searchType: dto.searchType ?? 'order',
        });
    }
}
