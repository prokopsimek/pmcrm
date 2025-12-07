import { Controller, Get, Param, Query, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TimelineQueryDto, TimelineResponseDto } from './dto';
import { TimelineService } from './timeline.service';

/**
 * TimelineController - Unified timeline for contact interactions
 * Aggregates emails, meetings, calls, notes into a single timeline
 */
@ApiTags('Timeline')
@ApiBearerAuth()
@Controller('contacts/:contactId/timeline')
export class TimelineController {
  constructor(private readonly timelineService: TimelineService) {}

  /**
   * GET /api/v1/contacts/:contactId/timeline
   * Returns unified timeline with filtering and pagination
   */
  @Get()
  @ApiOperation({ summary: 'Get unified timeline for a contact' })
  @ApiQuery({
    name: 'types',
    required: false,
    description:
      'Filter by event types (comma-separated): email, meeting, call, note, linkedin_message, linkedin_connection, whatsapp, other',
    type: String,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search term to filter events',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'Pagination cursor (ISO date string)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of items per page (default: 20, max: 100)',
  })
  @ApiResponse({
    status: 200,
    description: 'Timeline events retrieved successfully',
    type: TimelineResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async getTimeline(
    @Param('contactId') contactId: string,
    @Query() query: TimelineQueryDto,
    @Request() req: any,
  ): Promise<TimelineResponseDto> {
    const userId = req.user?.id;
    return this.timelineService.getTimeline(userId, contactId, query);
  }
}
