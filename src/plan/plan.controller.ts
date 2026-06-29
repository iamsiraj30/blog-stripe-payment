import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { PlanService } from './plan.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';

@ApiTags('Plans')
@Controller('plans')
export class PlanController {
  constructor(private readonly planService: PlanService) {}

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Create a subscription plan (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Plan successfully created and synchronized with Stripe.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. Admin privileges required.',
  })
  create(@Body() dto: CreatePlanDto) {
    return this.planService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all subscription plans' })
  @ApiResponse({ status: 200, description: 'All plans successfully listed.' })
  findAll() {
    return this.planService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve plan details by ID' })
  @ApiParam({ name: 'id', description: 'The UUID of the Plan' })
  @ApiResponse({
    status: 200,
    description: 'Plan details retrieved successfully.',
  })
  @ApiResponse({ status: 404, description: 'Plan not found.' })
  findOne(@Param('id') id: string) {
    return this.planService.findOne(id);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update plan details (Admin only)' })
  @ApiParam({ name: 'id', description: 'The UUID of the Plan' })
  @ApiResponse({
    status: 200,
    description: 'Plan details updated successfully.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. Admin privileges required.',
  })
  @ApiResponse({ status: 404, description: 'Plan not found.' })
  update(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.planService.update(id, dto);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a plan (Admin only)' })
  @ApiParam({ name: 'id', description: 'The UUID of the Plan' })
  @ApiResponse({
    status: 200,
    description: 'Plan successfully deleted and deactivated on Stripe.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. Admin privileges required.',
  })
  @ApiResponse({ status: 404, description: 'Plan not found.' })
  remove(@Param('id') id: string) {
    return this.planService.remove(id);
  }
}
