/**
 * Email Matcher Service
 * US-030: Email communication sync
 * Matches email participants to existing contacts
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/shared/database/prisma.service';
import { EmailMessage, EmailAddress } from '../interfaces/email.interface';
import { Contact } from '@prisma/client';

@Injectable()
export class EmailMatcherService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Match email participants to existing contacts in the database
   */
  async matchEmailToContacts(
    userId: string,
    email: EmailMessage,
    excludeEmail?: string,
  ): Promise<Contact[]> {
    const participantEmails = this.extractEmailAddresses(email, excludeEmail);

    if (participantEmails.length === 0) {
      return [];
    }

    const contacts = await this.prisma.contact.findMany({
      where: {
        userId,
        email: {
          in: participantEmails,
        },
        deletedAt: null,
      },
    });

    return contacts;
  }

  /**
   * Check if email should be excluded from sync based on user's exclusion list
   * TODO: Implement when EmailSyncConfig model is added to schema
   */
  async shouldExcludeEmail(userId: string, email: string): Promise<boolean> {
    // TODO: Look up EmailSyncConfig from database when model is added
    // For now, no emails are excluded
    return false;
  }

  /**
   * Extract all unique email addresses from an email message
   */
  extractEmailAddresses(email: EmailMessage, excludeEmail?: string): string[] {
    const addresses: string[] = [];

    // Add from address
    if (email.from?.email) {
      addresses.push(email.from.email);
    }

    // Add to addresses
    if (email.to) {
      addresses.push(...email.to.map((addr) => addr.email));
    }

    // Add cc addresses
    if (email.cc) {
      addresses.push(...email.cc.map((addr) => addr.email));
    }

    // Deduplicate and filter
    const uniqueAddresses = [...new Set(addresses)];

    // Exclude specified email (e.g., user's own email)
    if (excludeEmail) {
      return uniqueAddresses.filter((addr) => addr.toLowerCase() !== excludeEmail.toLowerCase());
    }

    return uniqueAddresses;
  }
}
