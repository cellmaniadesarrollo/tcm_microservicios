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
}
