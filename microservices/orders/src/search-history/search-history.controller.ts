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
            data: any;
        },
    ) {
        return this.searchHistoryService.saveFromSearch({
            companyId: payload.user.companyId,
            userId: payload.user.userId,
            searchTerm: payload.data.searchTerm,
            resultCount: payload.data.resultCount,
            searchType: payload.data.searchType ?? 'order',
        });
    }
}
