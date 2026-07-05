import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { PropertiesModule } from './modules/properties/properties.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { RecommendationsModule } from './modules/recommendations/recommendations.module';

@Module({
  imports: [PrismaModule, PropertiesModule, TrackingModule, RecommendationsModule],
})
export class AppModule {}
