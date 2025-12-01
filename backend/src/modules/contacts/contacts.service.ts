import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { OcrService } from './services/ocr.service';
import { LinkedInEnrichmentService } from './services/linkedin-enrichment.service';
import {
  CreateContactDto,
  UpdateContactDto,
  BusinessCardScanDto,
  BusinessCardParseResult,
  CheckDuplicateDto,
  DuplicateCheckResult,
  LinkedInEnrichmentDto,
  LinkedInEnrichmentResult,
} from './dto';

interface GetContactsOptions {
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * ContactsService - US-012: Manual Contact Addition
 * Implements CRUD, OCR, autocomplete, enrichment, and duplicate prevention
 */
@Injectable()
export class ContactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ocrService: OcrService,
    private readonly linkedInService: LinkedInEnrichmentService,
  ) {}

  /**
   * Get all contacts for a user with optional search and pagination
   */
  async getContacts(userId: string, options: GetContactsOptions = {}): Promise<any> {
    const { search, page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const where: any = {
      userId,
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [contacts, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          contactTags: {
            include: {
              tag: true,
            },
          },
          employments: {
            where: { isCurrent: true },
            include: {
              company: true,
            },
          },
        },
      }),
      this.prisma.contact.count({ where }),
    ]);

    // Transform contacts to include company and position from employment
    const transformedContacts = contacts.map((contact: any) => {
      const currentEmployment = contact.employments?.[0];
      return {
        id: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        phone: contact.phone,
        company: currentEmployment?.company?.name || contact.company || null,
        position: currentEmployment?.title || contact.position || null,
        notes: contact.notes,
        tags: contact.contactTags?.map((ct: any) => ct.tag.name) || contact.tags || [],
        lastContactedAt: contact.lastContact,
        createdAt: contact.createdAt,
        updatedAt: contact.updatedAt,
      };
    });

    return {
      data: transformedContacts,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single contact by ID
   */
  async getContact(userId: string, contactId: string): Promise<any> {
    const contact = await this.prisma.contact.findFirst({
      where: {
        id: contactId,
        userId,
        deletedAt: null,
      },
      include: {
        contactTags: {
          include: {
            tag: true,
          },
        },
        employments: {
          where: { isCurrent: true },
          include: {
            company: true,
          },
        },
      },
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    const currentEmployment = (contact as any).employments?.[0];
    return {
      id: contact.id,
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      phone: contact.phone,
      company: currentEmployment?.company?.name || contact.company || null,
      position: currentEmployment?.title || contact.position || null,
      notes: contact.notes,
      tags: (contact as any).contactTags?.map((ct: any) => ct.tag.name) || contact.tags || [],
      lastContactedAt: contact.lastContact,
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt,
    };
  }

  /**
   * Update a contact
   */
  async updateContact(userId: string, contactId: string, dto: UpdateContactDto): Promise<any> {
    const contact = await this.prisma.contact.findFirst({
      where: {
        id: contactId,
        userId,
        deletedAt: null,
      },
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    // Validate email if provided
    if (dto.email && !this.isValidEmail(dto.email)) {
      throw new BadRequestException('Invalid email format');
    }

    // Validate phone if provided
    if (dto.phone && !this.isValidPhone(dto.phone)) {
      throw new BadRequestException('Invalid phone format. Use E.164 format (e.g., +14155552671)');
    }

    return this.prisma.$transaction(async (tx) => {
      // Update contact
      const updatedContact = await tx.contact.update({
        where: { id: contactId },
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          phone: dto.phone,
          linkedinUrl: dto.linkedinUrl,
          notes: dto.notes,
          contactFrequencyDays: dto.contactFrequencyDays,
        },
      });

      // Handle company/organization update if provided
      if (dto.company !== undefined || dto.title !== undefined) {
        // Remove current employment
        await tx.contactEmployment.deleteMany({
          where: { contactId, isCurrent: true },
        });

        if (dto.company) {
          const companyId = await this.findOrCreateCompany(tx, userId, dto.company);
          await tx.contactEmployment.create({
            data: {
              contactId,
              companyId,
              title: dto.title,
              isCurrent: true,
            },
          });
        }
      }

      // Handle tags update if provided
      if (dto.tags) {
        // Remove existing tags
        await tx.contactTag.deleteMany({
          where: { contactId },
        });

        // Assign new tags
        if (dto.tags.length > 0) {
          await this.assignTagsInternal(tx, userId, contactId, dto.tags);
        }
      }

      return this.getContact(userId, contactId);
    });
  }

  /**
   * Delete a contact (soft delete)
   */
  async deleteContact(userId: string, contactId: string): Promise<{ success: boolean }> {
    const contact = await this.prisma.contact.findFirst({
      where: {
        id: contactId,
        userId,
        deletedAt: null,
      },
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    await this.prisma.contact.update({
      where: { id: contactId },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }

  /**
   * Create contact with validation and duplicate checking
   */
  async createContact(userId: string, dto: CreateContactDto): Promise<any> {
    // Validate email format (RFC 5322)
    if (dto.email && !this.isValidEmail(dto.email)) {
      throw new BadRequestException('Invalid email format');
    }

    // Validate phone format (E.164)
    if (dto.phone && !this.isValidPhone(dto.phone)) {
      throw new BadRequestException('Invalid phone format. Use E.164 format (e.g., +14155552671)');
    }

    // Check for duplicates
    if (dto.email || dto.phone) {
      const duplicate = await this.checkDuplicate(userId, {
        email: dto.email,
        phone: dto.phone,
      });

      if (duplicate.isDuplicate) {
        throw new BadRequestException(
          `Contact already exists with this ${dto.email ? 'email' : 'phone'}`,
        );
      }
    }

    // Create contact in transaction
    return this.prisma.$transaction(async (tx) => {
      // Create contact
      const contact = await tx.contact.create({
        data: {
          userId,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          phone: dto.phone,
          linkedinUrl: dto.linkedinUrl,
          notes: dto.notes,
          contactFrequencyDays: dto.contactFrequencyDays,
        },
      });

      // Handle company/organization
      if (dto.company || dto.companyId) {
        const companyId =
          dto.companyId || (await this.findOrCreateCompany(tx, userId, dto.company!));

        await tx.contactEmployment.create({
          data: {
            contactId: contact.id,
            companyId,
            title: dto.title,
            isCurrent: true,
          },
        });
      }

      // Assign tags
      if (dto.tags && dto.tags.length > 0) {
        await this.assignTagsInternal(tx, userId, contact.id, dto.tags);
      }

      // Save meeting context as interaction
      if (dto.meetingContext) {
        await tx.interaction.create({
          data: {
            userId,
            interactionType: 'meeting',
            occurredAt: dto.meetingContext.when ? new Date(dto.meetingContext.when) : new Date(),
            summary: dto.meetingContext.topic,
            meetingData: {
              location: dto.meetingContext.location,
            },
            participants: {
              create: [
                {
                  contactId: contact.id,
                  role: 'attendee',
                },
              ],
            },
          },
        });
      }

      return contact;
    });
  }

  /**
   * Parse business card image using OCR
   */
  async parseBusinessCard(
    userId: string,
    dto: BusinessCardScanDto,
  ): Promise<BusinessCardParseResult> {
    return this.ocrService.parseBusinessCard(dto.imageData, dto.mimeType);
  }

  /**
   * Autocomplete company names with fuzzy search
   */
  async autoCompleteCompany(userId: string, query: string): Promise<any[]> {
    if (!query || query.length < 2) {
      throw new BadRequestException('Query must be at least 2 characters');
    }

    // PostgreSQL trigram search
    return this.prisma.company.findMany({
      where: {
        userId,
        deletedAt: null,
        name: {
          contains: query,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        name: true,
        domain: true,
        logoUrl: true,
      },
      take: 10,
      orderBy: {
        name: 'asc',
      },
    });
  }

  /**
   * Enrich contact from LinkedIn profile
   */
  async enrichFromLinkedIn(
    userId: string,
    contactId: string,
    dto: LinkedInEnrichmentDto,
  ): Promise<LinkedInEnrichmentResult> {
    // Find contact and verify ownership
    const contact = await this.prisma.contact.findFirst({
      where: {
        id: contactId,
        userId,
        deletedAt: null,
      },
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    // Check if enrichment data is cached and valid
    if (
      contact.enrichmentLastUpdate &&
      this.linkedInService.isCacheValid(contact.enrichmentLastUpdate)
    ) {
      return {
        ...(contact.enrichmentData as any)?.linkedin,
        success: true,
        source: 'cache',
      };
    }

    try {
      // Call LinkedIn enrichment service (it handles saving internally)
      const enrichmentResult = await this.linkedInService.enrichByLinkedInUrl(
        userId,
        contactId,
        dto.linkedinUrl,
      );

      return enrichmentResult;
    } catch (error) {
      return {
        success: false,
        source: 'error',
        photoUrl: undefined,
        headline: undefined,
        summary: undefined,
        location: undefined,
        firstName: undefined,
        lastName: undefined,
        positions: [],
        education: [],
        skills: [],
      };
    }
  }

  /**
   * Check for duplicate contacts by email or phone
   */
  async checkDuplicate(userId: string, dto: CheckDuplicateDto): Promise<DuplicateCheckResult> {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Either email or phone must be provided');
    }

    const existingContact = await this.prisma.contact.findFirst({
      where: {
        userId,
        deletedAt: null,
        OR: [dto.email ? { email: dto.email } : {}, dto.phone ? { phone: dto.phone } : {}].filter(
          (condition) => Object.keys(condition).length > 0,
        ),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
      },
    });

    return {
      isDuplicate: !!existingContact,
      existingContact: existingContact
        ? {
            id: existingContact.id,
            firstName: existingContact.firstName,
            lastName: existingContact.lastName ?? undefined,
            email: existingContact.email ?? undefined,
            phone: existingContact.phone ?? undefined,
          }
        : undefined,
    };
  }

  /**
   * Assign tags to contact
   */
  async assignTags(userId: string, contactId: string, tagNames: string[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.assignTagsInternal(tx, userId, contactId, tagNames);
    });
  }

  /**
   * Set reminder frequency for contact
   */
  async setReminderFrequency(
    userId: string,
    contactId: string,
    frequencyDays: number,
  ): Promise<any> {
    if (frequencyDays < 1 || frequencyDays > 365) {
      throw new BadRequestException('Frequency must be between 1 and 365 days');
    }

    const contact = await this.prisma.contact.findFirst({
      where: {
        id: contactId,
        userId,
        deletedAt: null,
      },
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    return this.prisma.contact.update({
      where: { id: contactId },
      data: {
        contactFrequencyDays: frequencyDays,
      },
    });
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Validate email format (RFC 5322 compliant)
   */
  private isValidEmail(email: string): boolean {
    const emailRegex =
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return emailRegex.test(email);
  }

  /**
   * Validate phone format (E.164 format)
   */
  private isValidPhone(phone: string): boolean {
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(phone);
  }

  /**
   * Find or create company by name
   */
  private async findOrCreateCompany(tx: any, userId: string, companyName: string): Promise<string> {
    // Try to find existing company
    let company = await tx.company.findFirst({
      where: {
        userId,
        name: companyName,
        deletedAt: null,
      },
    });

    // Create if not found
    if (!company) {
      company = await tx.company.create({
        data: {
          userId,
          name: companyName,
        },
      });
    }

    return company.id;
  }

  /**
   * Get reminders for a specific contact
   */
  async getContactReminders(userId: string, contactId: string): Promise<any[]> {
    // Verify contact belongs to user
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, userId, deletedAt: null },
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    const reminders = await this.prisma.reminder.findMany({
      where: { contactId },
      orderBy: { scheduledFor: 'asc' },
    });

    return reminders.map((r) => ({
      id: r.id,
      title: r.title,
      message: r.message,
      scheduledFor: r.scheduledFor,
      dueAt: r.dueAt,
      frequencyDays: r.frequencyDays,
      priority: r.priority,
      status: r.status,
      snoozedUntil: r.snoozedUntil,
      completedAt: r.completedAt,
      createdAt: r.createdAt,
    }));
  }

  /**
   * Assign tags to contact (internal transaction method)
   */
  private async assignTagsInternal(
    tx: any,
    userId: string,
    contactId: string,
    tagNames: string[],
  ): Promise<void> {
    // Find existing tags
    const existingTags = await tx.tag.findMany({
      where: {
        userId,
        name: {
          in: tagNames,
        },
      },
    });

    const existingTagNames = existingTags.map((t: any) => t.name);
    const newTagNames = tagNames.filter((name) => !existingTagNames.includes(name));

    // Create new tags
    const newTags = await Promise.all(
      newTagNames.map((name) =>
        tx.tag.create({
          data: {
            userId,
            name,
          },
        }),
      ),
    );

    // Combine all tags
    const allTags = [...existingTags, ...newTags];

    // Create contact-tag relationships
    await tx.contactTag.createMany({
      data: allTags.map((tag: any) => ({
        contactId,
        tagId: tag.id,
        userId,
      })),
      skipDuplicates: true,
    });
  }
}
