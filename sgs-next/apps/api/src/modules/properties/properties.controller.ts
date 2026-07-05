import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { QueryPropertyDto } from './dto/query-property.dto';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

@Controller('properties')
export class PropertiesController {
  constructor(private readonly service: PropertiesService) {}

  @Get()
  search(@CurrentTenant() tenantId: string, @Query() query: QueryPropertyDto) {
    return this.service.search(tenantId, query);
  }

  @Get(':id')
  getById(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.getById(tenantId, id);
  }

  @Post()
  create(@CurrentTenant() tenantId: string, @Body() dto: CreatePropertyDto) {
    // brokerId will come from the authenticated principal once AuthModule lands
    return this.service.create(tenantId, null, dto);
  }

  @Patch(':id')
  update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePropertyDto,
  ) {
    return this.service.update(tenantId, id, dto);
  }

  @Delete(':id')
  archive(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.archive(tenantId, id);
  }
}
