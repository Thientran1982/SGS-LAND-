import { Controller, Get, Param, Query } from '@nestjs/common';
import { RecommendationsService } from './recommendations.service';
import { SimilarPropertiesQueryDto } from './dto/similar-properties-query.dto';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

/**
 * "Có thể bạn quan tâm" — on-site widget data source. Mounted under
 * /properties/:id/recommendations to sit next to the Properties module.
 */
@Controller('properties/:id/recommendations')
export class RecommendationsController {
  constructor(private readonly service: RecommendationsService) {}

  @Get()
  getSimilar(
    @CurrentTenant() tenantId: string,
    @Param('id') propertyId: string,
    @Query() query: SimilarPropertiesQueryDto,
  ) {
    return this.service.getSimilarProperties(tenantId, propertyId, query.limit);
  }
}
