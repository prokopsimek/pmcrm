import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { FullTextSearchService } from './services/full-text-search.service';
import { RankingService } from './services/ranking.service';
import { HighlightingService } from './services/highlighting.service';
import { EmbeddingService } from './services/embedding.service';
import { SemanticSearchService } from './services/semantic-search.service';
import { DatabaseModule } from '@/shared/database/database.module';

@Module({
  imports: [DatabaseModule, ConfigModule],
  controllers: [SearchController],
  providers: [
    SearchService,
    FullTextSearchService,
    RankingService,
    HighlightingService,
    EmbeddingService,
    SemanticSearchService,
  ],
  exports: [SearchService, EmbeddingService],
})
export class SearchModule {}
