import { Injectable, Logger } from '@nestjs/common';
import { ConflictDto, ConflictStrategy, ResolvedConflictDto } from '../dto/import-contacts.dto';

/**
 * Conflict Resolver Service
 * Handles conflict detection and resolution for bidirectional sync
 */
@Injectable()
export class ConflictResolverService {
  private readonly logger = new Logger(ConflictResolverService.name);

  /**
   * Detect conflicts between CRM and Outlook contacts
   */
  detectConflicts(
    crmContact: any,
    outlookContact: any,
    fieldsToCheck: string[] = ['firstName', 'lastName', 'email', 'phone', 'company', 'position'],
  ): ConflictDto[] {
    this.logger.log('Detecting conflicts between contacts');

    const conflicts: ConflictDto[] = [];

    for (const field of fieldsToCheck) {
      const crmValue = crmContact[field];
      const outlookValue = this.getOutlookFieldValue(outlookContact, field);

      // Skip if values are equal
      if (this.areValuesEqual(crmValue, outlookValue)) {
        continue;
      }

      // Both values exist but differ - conflict!
      if (crmValue && outlookValue) {
        conflicts.push({
          field,
          crmValue,
          outlookValue,
          conflictType: 'VALUE_MISMATCH',
        });
      }
    }

    return conflicts;
  }

  /**
   * Resolve a single conflict using specified strategy
   */
  resolveConflict(conflict: ConflictDto, strategy: ConflictStrategy): any {
    this.logger.log(`Resolving conflict for field ${conflict.field} using ${strategy}`);

    switch (strategy) {
      case ConflictStrategy.CRM_PRIORITY:
        return conflict.crmValue;

      case ConflictStrategy.OUTLOOK_PRIORITY:
        return conflict.outlookValue;

      case ConflictStrategy.LAST_WRITE_WINS:
        // Would need timestamp metadata to implement properly
        // For now, default to CRM priority
        this.logger.warn('LAST_WRITE_WINS requires timestamp metadata, using CRM_PRIORITY');
        return conflict.crmValue;

      case ConflictStrategy.MANUAL_REVIEW:
        // Return null to indicate manual review needed
        return null;

      default:
        throw new Error(`Unknown conflict strategy: ${strategy}`);
    }
  }

  /**
   * Apply conflict resolution strategy to multiple conflicts
   */
  async applyStrategy(
    conflicts: ConflictDto[],
    strategy: ConflictStrategy,
  ): Promise<ResolvedConflictDto[]> {
    this.logger.log(`Applying ${strategy} to ${conflicts.length} conflicts`);

    const resolved: ResolvedConflictDto[] = [];

    for (const conflict of conflicts) {
      const resolvedValue = this.resolveConflict(conflict, strategy);

      resolved.push({
        contactId: conflict.field, // This would be the actual contact ID in real usage
        field: conflict.field,
        resolvedValue,
        strategy,
      });
    }

    return resolved;
  }

  /**
   * Prepare conflict report for manual review
   */
  prepareConflictReport(conflicts: ConflictDto[]): any {
    this.logger.log('Preparing conflict report for manual review');

    return {
      totalConflicts: conflicts.length,
      conflictsByField: this.groupConflictsByField(conflicts),
      requiresManualReview: conflicts.length > 0,
      conflicts,
    };
  }

  /**
   * Merge two contacts using specified strategy
   */
  mergeContacts(crmContact: any, outlookContact: any, strategy: ConflictStrategy): any {
    this.logger.log('Merging contacts');

    const conflicts = this.detectConflicts(crmContact, outlookContact);
    const merged = { ...crmContact };

    for (const conflict of conflicts) {
      const resolvedValue = this.resolveConflict(conflict, strategy);
      if (resolvedValue !== null) {
        merged[conflict.field] = resolvedValue;
      }
    }

    return merged;
  }

  // Private helper methods

  /**
   * Get Outlook field value (handle different field names)
   */
  private getOutlookFieldValue(outlookContact: any, field: string): any {
    const fieldMapping: Record<string, string> = {
      firstName: 'givenName',
      lastName: 'surname',
      email: 'emailAddresses[0].address',
      phone: 'mobilePhone',
      company: 'companyName',
      position: 'jobTitle',
    };

    const outlookField = fieldMapping[field] || field;

    // Handle nested fields (e.g., emailAddresses[0].address)
    if (outlookField.includes('[')) {
      const parts = outlookField.split(/[\[\].]+/).filter(Boolean);
      let value = outlookContact;
      for (const part of parts) {
        if (value === undefined || value === null) break;
        value = value[part];
      }
      return value;
    }

    return outlookContact[outlookField];
  }

  /**
   * Compare values for equality (handle nulls, empty strings, etc.)
   */
  private areValuesEqual(value1: any, value2: any): boolean {
    // Normalize empty values
    const normalizeEmpty = (val: any) => {
      if (val === null || val === undefined || val === '') return null;
      return val;
    };

    const v1 = normalizeEmpty(value1);
    const v2 = normalizeEmpty(value2);

    // Both empty
    if (v1 === null && v2 === null) return true;

    // One empty, one not
    if (v1 === null || v2 === null) return false;

    // String comparison (case-insensitive)
    if (typeof v1 === 'string' && typeof v2 === 'string') {
      return v1.toLowerCase().trim() === v2.toLowerCase().trim();
    }

    // Default comparison
    return v1 === v2;
  }

  /**
   * Group conflicts by field for reporting
   */
  private groupConflictsByField(conflicts: ConflictDto[]): Record<string, number> {
    const grouped: Record<string, number> = {};

    for (const conflict of conflicts) {
      grouped[conflict.field] = (grouped[conflict.field] || 0) + 1;
    }

    return grouped;
  }
}
