import { Module } from '@nestjs/common';
import { SearchHistoryController } from './search-history.controller';
import { SearchHistoryService } from './search-history.service';
import { GroupSearchHistory } from './entities/group-search-history.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroupCache } from '../users-employees-events/entities/group_cache.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([GroupSearchHistory, GroupCache]),
  ],
  controllers: [SearchHistoryController],
  providers: [SearchHistoryService],
  exports: [SearchHistoryService],
})
export class SearchHistoryModule { }
