import {
  Body,
  Controller,
  Delete,
  Get,
  MessageEvent,
  Param,
  Patch,
  Post,
  Query,
  Request,
  Sse,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { ContactSummaryService } from '../ai/services/contact-summary.service';
import { ContactEmailService } from '../integrations/email-sync/services/contact-email.service';
import { ContactsService } from './contacts.service';
import {
  BusinessCardScanDto,
  CreateContactDto,
  LinkedInEnrichmentDto,
  UpdateContactDto,
} from './dto';

/**
 * ContactsController - US-012: Manual Contact Addition
 * API endpoints for CRUD operations, OCR, autocomplete, enrichment
 * Also includes email timeline and AI summary endpoints
 */
@ApiTags('Contacts')
@ApiBearerAuth()
@Controller('contacts')
export class ContactsController {
  constructor(
    private readonly contactsService: ContactsService,
    private readonly contactEmailService: ContactEmailService,
    private readonly contactSummaryService: ContactSummaryService,
  ) {}

  /**
   * GET /api/v1/contacts - List all contacts with optional search and filters
   * US-061: Advanced Filtering
   */
  @Get()
  @ApiOperation({ summary: 'List all contacts with filters' })
  @ApiQuery({ name: 'search', required: false, description: 'Search by name, email' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  @ApiQuery({
    name: 'tags',
    required: false,
    description: 'Filter by tag names (comma-separated)',
    type: String,
  })
  @ApiQuery({
    name: 'company',
    required: false,
    description: 'Filter by company name (partial match)',
  })
  @ApiQuery({
    name: 'position',
    required: false,
    description: 'Filter by position/title (partial match)',
  })
  @ApiQuery({
    name: 'location',
    required: false,
    description: 'Filter by location (partial match)',
  })
  @ApiQuery({
    name: 'source',
    required: false,
    description: 'Filter by source (MANUAL, IMPORT, GOOGLE_CONTACTS, etc.)',
  })
  @ApiQuery({ name: 'hasEmail', required: false, description: 'Filter by has email (true/false)' })
  @ApiQuery({ name: 'hasPhone', required: false, description: 'Filter by has phone (true/false)' })
  @ApiQuery({
    name: 'lastContactedFrom',
    required: false,
    description: 'Filter by last contacted after date (ISO)',
  })
  @ApiQuery({
    name: 'lastContactedTo',
    required: false,
    description: 'Filter by last contacted before date (ISO)',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    description: 'Sort by field (lastContact, importance, name, createdAt)',
    enum: ['lastContact', 'importance', 'name', 'createdAt'],
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    description: 'Sort order (asc, desc)',
    enum: ['asc', 'desc'],
  })
  @ApiResponse({ status: 200, description: 'List of contacts' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(
    @Request() req: any,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('tags') tags?: string,
    @Query('company') company?: string,
    @Query('position') position?: string,
    @Query('location') location?: string,
    @Query('source') source?: string,
    @Query('hasEmail') hasEmail?: string,
    @Query('hasPhone') hasPhone?: string,
    @Query('lastContactedFrom') lastContactedFrom?: string,
    @Query('lastContactedTo') lastContactedTo?: string,
    @Query('sortBy') sortBy?: 'lastContact' | 'importance' | 'name' | 'createdAt',
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }

    // Parse filter parameters
    const parsedTags = tags
      ? tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : undefined;
    const parsedHasEmail = hasEmail === 'true' ? true : hasEmail === 'false' ? false : undefined;
    const parsedHasPhone = hasPhone === 'true' ? true : hasPhone === 'false' ? false : undefined;
    const parsedLastContactedFrom = lastContactedFrom ? new Date(lastContactedFrom) : undefined;
    const parsedLastContactedTo = lastContactedTo ? new Date(lastContactedTo) : undefined;

    return this.contactsService.getContacts(req.user.id, {
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      sortBy,
      sortOrder,
      tags: parsedTags,
      company,
      position,
      location,
      source,
      hasEmail: parsedHasEmail,
      hasPhone: parsedHasPhone,
      lastContactedFrom: parsedLastContactedFrom,
      lastContactedTo: parsedLastContactedTo,
    });
  }

  /**
   * GET /api/v1/contacts/:id - Get a single contact by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a contact by ID' })
  @ApiResponse({ status: 200, description: 'Contact details' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async findOne(@Request() req: any, @Param('id') id: string) {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }

    return this.contactsService.getContact(req.user.id, id);
  }

  /**
   * POST /api/v1/contacts - Create new contact with quick-add form
   */
  @Post()
  @ApiOperation({ summary: 'Create a new contact' })
  @ApiResponse({ status: 201, description: 'Contact created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(@Request() req: any, @Body() createDto: CreateContactDto) {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }

    return this.contactsService.createContact(req.user.id, createDto);
  }

  /**
   * PATCH /api/v1/contacts/:id - Update a contact
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Update a contact' })
  @ApiResponse({ status: 200, description: 'Contact updated successfully' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async update(@Request() req: any, @Param('id') id: string, @Body() updateDto: UpdateContactDto) {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }

    return this.contactsService.updateContact(req.user.id, id, updateDto);
  }

  /**
   * DELETE /api/v1/contacts/:id - Delete a contact
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a contact' })
  @ApiResponse({ status: 200, description: 'Contact deleted successfully' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async remove(@Request() req: any, @Param('id') id: string) {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }

    return this.contactsService.deleteContact(req.user.id, id);
  }

  /**
   * GET /api/v1/contacts/:id/emails - Get email timeline for a contact
   */
  @Get(':id/emails')
  @ApiOperation({ summary: 'Get email timeline for a contact' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of emails to return' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Pagination cursor' })
  @ApiQuery({ name: 'sync', required: false, description: 'Force sync from Gmail' })
  @ApiResponse({ status: 200, description: 'Email timeline' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async getEmails(
    @Request() req: any,
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('sync') sync?: string,
  ) {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }

    return this.contactEmailService.getContactEmails(req.user.id, id, {
      limit: limit ? parseInt(limit, 10) : 20,
      cursor,
      forceSync: sync === 'true',
    });
  }

  /**
   * GET /api/v1/contacts/:id/emails/:emailId - Get single email with full body content
   */
  @Get(':id/emails/:emailId')
  @ApiOperation({ summary: 'Get single email with full body content' })
  @ApiResponse({ status: 200, description: 'Email with body' })
  @ApiResponse({ status: 404, description: 'Contact or email not found' })
  async getEmailById(
    @Request() req: any,
    @Param('id') id: string,
    @Param('emailId') emailId: string,
  ) {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }

    return this.contactEmailService.getEmailById(req.user.id, id, emailId);
  }

  /**
   * GET /api/v1/contacts/:id/emails/stream - Stream emails with AI summaries (SSE)
   * Progressively returns emails as their AI summaries are generated
   */
  @Sse(':id/emails/stream')
  @ApiOperation({ summary: 'Stream emails with progressive AI summary generation (SSE)' })
  @ApiQuery({ name: 'regenerate', required: false, description: 'Regenerate missing AI summaries' })
  streamEmails(
    @Request() req: any,
    @Param('id') id: string,
    @Query('regenerate') regenerate?: string,
  ): Observable<MessageEvent> {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }

    return this.contactEmailService.streamEmailsWithSummaries(
      req.user.id,
      id,
      regenerate === 'true',
    );
  }

  /**
   * GET /api/v1/contacts/:id/ai-summary - Get AI-generated summary for a contact
   */
  @Get(':id/ai-summary')
  @ApiOperation({ summary: 'Get AI summary of communication history' })
  @ApiQuery({ name: 'regenerate', required: false, description: 'Force regenerate summary' })
  @ApiResponse({ status: 200, description: 'AI summary' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async getAISummary(
    @Request() req: any,
    @Param('id') id: string,
    @Query('regenerate') regenerate?: string,
  ) {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }

    return this.contactSummaryService.getTimelineSummary(req.user.id, id, regenerate === 'true');
  }

  /**
   * POST /api/v1/contacts/:id/ai-summary - Force regenerate AI summary
   */
  @Post(':id/ai-summary')
  @ApiOperation({ summary: 'Regenerate AI summary' })
  @ApiResponse({ status: 200, description: 'AI summary regenerated' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async regenerateAISummary(@Request() req: any, @Param('id') id: string) {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }

    return this.contactSummaryService.getTimelineSummary(req.user.id, id, true);
  }

  /**
   * GET /api/v1/contacts/:id/recommendations - Get AI-generated recommendations
   */
  @Get(':id/recommendations')
  @ApiOperation({ summary: 'Get AI recommendations for next steps' })
  @ApiQuery({
    name: 'regenerate',
    required: false,
    description: 'Force regenerate recommendations',
  })
  @ApiResponse({ status: 200, description: 'AI recommendations' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async getRecommendations(
    @Request() req: any,
    @Param('id') id: string,
    @Query('regenerate') regenerate?: string,
  ) {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }

    return this.contactSummaryService.getRecommendations(req.user.id, id, regenerate === 'true');
  }

  /**
   * GET /api/v1/contacts/:id/reminders - Get reminders for a contact
   */
  @Get(':id/reminders')
  @ApiOperation({ summary: 'Get reminders for a contact' })
  @ApiResponse({ status: 200, description: 'Contact reminders' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async getReminders(@Request() req: any, @Param('id') id: string) {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }

    return this.contactsService.getContactReminders(req.user.id, id);
  }

  /**
   * POST /api/v1/contacts/business-card - Parse business card using OCR
   */
  @Post('business-card')
  @ApiOperation({ summary: 'Scan and parse business card' })
  @ApiResponse({ status: 200, description: 'Business card parsed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid image format or size' })
  async scanBusinessCard(@Request() req: any, @Body() scanDto: BusinessCardScanDto) {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }

    return this.contactsService.parseBusinessCard(req.user.id, scanDto);
  }

  /**
   * GET /api/v1/contacts/check-duplicate - Check for duplicate contacts
   */
  @Get('check-duplicate')
  @ApiOperation({ summary: 'Check for duplicate contacts by email or phone' })
  @ApiResponse({ status: 200, description: 'Duplicate check result' })
  async checkDuplicate(
    @Request() req: any,
    @Query('email') email?: string,
    @Query('phone') phone?: string,
  ) {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }

    return this.contactsService.checkDuplicate(req.user.id, { email, phone });
  }

  /**
   * POST /api/v1/contacts/:id/enrich/linkedin - Enrich contact from LinkedIn
   */
  @Post(':id/enrich/linkedin')
  @ApiOperation({ summary: 'Enrich contact with LinkedIn profile data' })
  @ApiResponse({ status: 200, description: 'Contact enriched successfully' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async enrichFromLinkedIn(
    @Request() req: any,
    @Param('id') id: string,
    @Body() enrichDto: LinkedInEnrichmentDto,
  ) {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }

    return this.contactsService.enrichFromLinkedIn(req.user.id, id, enrichDto);
  }
}

/**
 * OrganizationsController - Company autocomplete
 */
@ApiTags('Organizations')
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly contactsService: ContactsService) {}

  /**
   * GET /api/v1/organizations/autocomplete - Company name autocomplete
   */
  @Get('autocomplete')
  @ApiOperation({ summary: 'Autocomplete company names' })
  @ApiResponse({ status: 200, description: 'List of matching companies' })
  @ApiResponse({ status: 400, description: 'Invalid query' })
  async autoCompleteCompany(@Request() req: any, @Query('q') query: string) {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }

    return this.contactsService.autoCompleteCompany(req.user.id, query);
  }
}
