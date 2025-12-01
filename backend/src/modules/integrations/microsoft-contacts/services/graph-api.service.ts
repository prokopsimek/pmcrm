import { Injectable, Logger } from '@nestjs/common';

/**
 * Microsoft Graph API Service
 * Handles all direct communication with Microsoft Graph API
 */
@Injectable()
export class GraphApiService {
  private readonly logger = new Logger(GraphApiService.name);
  private readonly GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

  /**
   * Get contacts from Microsoft Graph API
   */
  async getContacts(
    accessToken: string,
    options?: {
      top?: number;
      nextLink?: string;
      deltaLink?: string;
      folderId?: string;
    },
  ): Promise<any> {
    this.logger.log('Fetching contacts from Microsoft Graph');

    let url: string;

    if (options?.nextLink) {
      url = options.nextLink;
    } else if (options?.deltaLink) {
      url = options.deltaLink;
    } else if (options?.folderId) {
      url = `${this.GRAPH_BASE_URL}/me/contactFolders/${options.folderId}/contacts`;
    } else {
      url = `${this.GRAPH_BASE_URL}/me/contacts`;
    }

    const urlObj = new URL(url);

    // Add query parameters if not using a nextLink or deltaLink
    if (!options?.nextLink && !options?.deltaLink) {
      urlObj.searchParams.append(
        '$select',
        'id,givenName,surname,emailAddresses,mobilePhone,businessPhones,companyName,jobTitle,categories,parentFolderId',
      );

      if (options?.top) {
        urlObj.searchParams.append('$top', options.top.toString());
      }
    }

    const response = await fetch(urlObj.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw { status: 429, message: 'Rate limit exceeded' };
      }
      const errorText = await response.text();
      throw new Error(`Microsoft Graph API error: ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Get a single contact by ID
   */
  async getContact(accessToken: string, contactId: string): Promise<any> {
    this.logger.log(`Fetching contact ${contactId}`);

    const url = `${this.GRAPH_BASE_URL}/me/contacts/${contactId}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch contact: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Create a new contact in Microsoft 365
   */
  async createContact(accessToken: string, contactData: any): Promise<any> {
    this.logger.log('Creating contact in Microsoft 365');

    const url = `${this.GRAPH_BASE_URL}/me/contacts`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(contactData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create contact: ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Update an existing contact in Microsoft 365
   */
  async updateContact(accessToken: string, contactId: string, contactData: any): Promise<any> {
    this.logger.log(`Updating contact ${contactId}`);

    const url = `${this.GRAPH_BASE_URL}/me/contacts/${contactId}`;

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(contactData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update contact: ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Delete a contact from Microsoft 365
   */
  async deleteContact(accessToken: string, contactId: string): Promise<void> {
    this.logger.log(`Deleting contact ${contactId}`);

    const url = `${this.GRAPH_BASE_URL}/me/contacts/${contactId}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to delete contact: ${response.statusText}`);
    }
  }

  /**
   * Get delta contacts (incremental sync)
   */
  async getDeltaContacts(accessToken: string, deltaLink?: string): Promise<any> {
    this.logger.log('Fetching delta contacts');

    const url = deltaLink || `${this.GRAPH_BASE_URL}/me/contacts/delta`;

    const urlObj = new URL(url);

    // Add select fields if this is the initial delta request
    if (!deltaLink) {
      urlObj.searchParams.append(
        '$select',
        'id,givenName,surname,emailAddresses,mobilePhone,businessPhones,companyName,jobTitle,categories,parentFolderId',
      );
    }

    const response = await fetch(urlObj.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 410) {
        // Delta token expired, need full sync
        this.logger.warn('Delta token expired, full sync required');
        throw { status: 410, message: 'Delta token expired' };
      }
      throw new Error(`Failed to fetch delta contacts: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get contacts from a specific folder
   */
  async getFolderContacts(
    accessToken: string,
    folderId: string,
    options?: { top?: number },
  ): Promise<any> {
    this.logger.log(`Fetching contacts from folder ${folderId}`);

    const url = `${this.GRAPH_BASE_URL}/me/contactFolders/${folderId}/contacts`;
    const urlObj = new URL(url);

    urlObj.searchParams.append(
      '$select',
      'id,givenName,surname,emailAddresses,mobilePhone,businessPhones,companyName,jobTitle,categories',
    );

    if (options?.top) {
      urlObj.searchParams.append('$top', options.top.toString());
    }

    const response = await fetch(urlObj.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch folder contacts: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get contact folders (including shared)
   */
  async getContactFolders(accessToken: string): Promise<any> {
    this.logger.log('Fetching contact folders');

    const url = `${this.GRAPH_BASE_URL}/me/contactFolders`;
    const urlObj = new URL(url);

    urlObj.searchParams.append('$select', 'id,displayName,parentFolderId');

    const response = await fetch(urlObj.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch contact folders: ${response.statusText}`);
    }

    const result = await response.json();

    // Transform to our DTO format
    return {
      value: (result.value || []).map((folder: any) => ({
        id: folder.id,
        name: folder.displayName,
        parentFolderId: folder.parentFolderId,
        isShared: folder.parentFolderId !== undefined, // Simplified check
      })),
    };
  }

  /**
   * Batch get contacts (for efficiency)
   */
  async batchGetContacts(accessToken: string, contactIds: string[]): Promise<any[]> {
    this.logger.log(`Batch fetching ${contactIds.length} contacts`);

    const batchRequests = contactIds.map((id, index) => ({
      id: index.toString(),
      method: 'GET',
      url: `/me/contacts/${id}`,
    }));

    const url = `${this.GRAPH_BASE_URL}/$batch`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests: batchRequests }),
    });

    if (!response.ok) {
      throw new Error(`Batch request failed: ${response.statusText}`);
    }

    const result = await response.json();
    return result.responses.filter((r: any) => r.status === 200).map((r: any) => r.body);
  }
}
