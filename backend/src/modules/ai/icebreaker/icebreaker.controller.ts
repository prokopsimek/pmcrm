/**
 * Icebreaker Controller - REST API Endpoints
 * US-051: AI icebreaker message generation
 */

import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Request,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { IcebreakerService } from './icebreaker.service';
import {
  GenerateIcebreakerDto,
  RegenerateIcebreakerDto,
  EditIcebreakerDto,
  SelectVariationDto,
  SubmitFeedbackDto,
  IcebreakerResponseDto,
  IcebreakerHistoryDto,
} from './dto/generate-icebreaker.dto';

@ApiTags('AI Icebreaker')
@Controller('api/v1/ai/icebreaker')
@ApiBearerAuth()
export class IcebreakerController {
  constructor(private readonly icebreakerService: IcebreakerService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate AI icebreaker message variations' })
  @ApiResponse({
    status: 201,
    description: 'Icebreaker generated successfully',
    type: IcebreakerResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async generate(
    @Request() req: any,
    @Body() dto: GenerateIcebreakerDto,
  ): Promise<IcebreakerResponseDto> {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.icebreakerService.generateIcebreaker(req.user.id, dto);
  }

  @Post(':id/regenerate')
  @ApiOperation({ summary: 'Regenerate icebreaker with different parameters' })
  @ApiResponse({
    status: 201,
    description: 'Icebreaker regenerated successfully',
    type: IcebreakerResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Generation not found' })
  async regenerate(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: RegenerateIcebreakerDto,
  ): Promise<IcebreakerResponseDto> {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.icebreakerService.regenerateIcebreaker(req.user.id, id, dto);
  }

  @Post(':id/edit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Edit generated icebreaker content' })
  @ApiResponse({ status: 200, description: 'Content edited successfully' })
  @ApiResponse({ status: 404, description: 'Generation not found' })
  async edit(@Request() req: any, @Param('id') id: string, @Body() dto: EditIcebreakerDto) {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.icebreakerService.editIcebreaker(req.user.id, id, dto);
  }

  @Post(':id/select')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Select a specific variation' })
  @ApiResponse({ status: 200, description: 'Variation selected successfully' })
  @ApiResponse({ status: 400, description: 'Invalid variation index' })
  @ApiResponse({ status: 404, description: 'Generation not found' })
  async selectVariation(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: SelectVariationDto,
  ) {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.icebreakerService.selectVariation(req.user.id, id, dto);
  }

  @Post(':id/feedback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit feedback on generated icebreaker' })
  @ApiResponse({ status: 200, description: 'Feedback submitted successfully' })
  @ApiResponse({ status: 404, description: 'Generation not found' })
  async submitFeedback(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: SubmitFeedbackDto,
  ) {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.icebreakerService.submitFeedback(req.user.id, id, dto);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get user icebreaker generation history' })
  @ApiResponse({
    status: 200,
    description: 'History retrieved successfully',
    type: [IcebreakerHistoryDto],
  })
  async getHistory(@Request() req: any): Promise<IcebreakerHistoryDto[]> {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.icebreakerService.getHistory(req.user.id);
  }
}





