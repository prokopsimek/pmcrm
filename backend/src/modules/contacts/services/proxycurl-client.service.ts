/**
 * Proxycurl API Client Service (US-013)
 * Integration with Proxycurl API for LinkedIn profile enrichment
 *
 * API Documentation: https://nubela.co/proxycurl/docs
 * Pricing: $0.015-0.06 per profile lookup
 * Rate Limit: 300 requests/minute
 */
import { Injectable, Logger, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// ============================================================================
// Proxycurl API Types
// ============================================================================

interface ProxycurlProfile {
  public_identifier: string;
  profile_pic_url: string;
  first_name: string;
  last_name: string;
  headline: string;
  summary: string;
  country_full_name: string;
  city: string;
  experiences: ProxycurlExperience[];
  education: ProxycurlEducation[];
  skills: string[];
}

interface ProxycurlExperience {
  company: string;
  company_linkedin_profile_url?: string;
  title: string;
  description?: string;
  location?: string;
  starts_at: { year: number; month: number; day?: number } | null;
  ends_at: { year: number; month: number; day?: number } | null;
}

interface ProxycurlEducation {
  school: string;
  school_linkedin_profile_url?: string;
  degree_name?: string;
  field_of_study?: string;
  starts_at: { year: number; month: number; day?: number } | null;
  ends_at: { year: number; month: number; day?: number } | null;
}

interface ProxycurlSearchResult {
  results: Array<{
    linkedin_profile_url: string;
    name: string;
    headline?: string;
    company?: string;
    location?: string;
  }>;
}

// ============================================================================
// Proxycurl Client Service
// ============================================================================

@Injectable()
export class ProxycurlClientService {
  private readonly logger = new Logger(ProxycurlClientService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://nubela.co/proxycurl/api/v2';
  private readonly costPerRequest = 0.03; // Average cost per profile lookup

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('PROXYCURL_API_KEY') || '';

    if (!this.apiKey) {
      this.logger.warn('PROXYCURL_API_KEY not configured. LinkedIn enrichment will use mock data.');
    }
  }

  /**
   * Fetch LinkedIn profile by URL
   * Cost: ~$0.03 per request
   */
  async fetchProfile(linkedinUrl: string): Promise<ProxycurlProfile> {
    this.logger.log(`Fetching LinkedIn profile: ${linkedinUrl}`);

    if (!this.apiKey) {
      return this.getMockProfile();
    }

    try {
      const response = await fetch(`${this.baseUrl}/linkedin`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        // @ts-ignore - URL is valid
        params: {
          url: linkedinUrl,
          fallback_to_cache: 'on-error',
          use_cache: 'if-present',
          skills: 'include',
        },
      });

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`Proxycurl API error: ${response.status} - ${error}`);
        throw new HttpException(`Proxycurl API error: ${error}`, response.status);
      }

      const data = await response.json();
      this.logger.log(`Successfully fetched profile for ${linkedinUrl}`);
      return data as ProxycurlProfile;
    } catch (error: any) {
      this.logger.error(`Failed to fetch LinkedIn profile: ${error.message}`);
      throw error;
    }
  }

  /**
   * Search LinkedIn profiles by email
   * Cost: ~$0.03 per request
   */
  async searchByEmail(email: string): Promise<{ linkedinUrl: string; matchScore: number } | null> {
    this.logger.log(`Searching LinkedIn by email: ${email}`);

    if (!this.apiKey) {
      // Mock response for testing
      if (email.includes('john.doe')) {
        return {
          linkedinUrl: 'https://www.linkedin.com/in/john-doe',
          matchScore: 0.95,
        };
      }
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/linkedin/person/resolve`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        // @ts-ignore
        params: {
          email: email,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          this.logger.log(`No LinkedIn profile found for email: ${email}`);
          return null;
        }
        throw new HttpException('Proxycurl search failed', response.status);
      }

      const data: any = await response.json();

      if (data.linkedin_profile_url) {
        return {
          linkedinUrl: data.linkedin_profile_url,
          matchScore: 0.95, // High confidence for email match
        };
      }

      return null;
    } catch (error: any) {
      this.logger.error(`Email search failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Search LinkedIn profiles by name and company
   * Cost: ~$0.03 per request
   */
  async searchByName(
    firstName: string,
    lastName: string,
    company?: string,
  ): Promise<Array<{ linkedinUrl: string; name: string; company?: string }>> {
    this.logger.log(
      `Searching LinkedIn by name: ${firstName} ${lastName} at ${company || 'any company'}`,
    );

    if (!this.apiKey) {
      // Mock response for testing
      return [
        {
          linkedinUrl: 'https://www.linkedin.com/in/john-doe',
          name: 'John Doe',
          company: company || 'Google',
        },
      ];
    }

    try {
      const searchQuery = company
        ? `${firstName} ${lastName} ${company}`
        : `${firstName} ${lastName}`;

      const response = await fetch(`${this.baseUrl}/search/person`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        // @ts-ignore
        params: {
          query: searchQuery,
          enrich_profiles: 'skip',
          page_size: 10,
        },
      });

      if (!response.ok) {
        throw new HttpException('Proxycurl search failed', response.status);
      }

      const data: ProxycurlSearchResult = await response.json();

      return data.results.map((result) => ({
        linkedinUrl: result.linkedin_profile_url,
        name: result.name,
        company: result.company,
      }));
    } catch (error: any) {
      this.logger.error(`Name search failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Get cost estimate for enrichment
   */
  getCostEstimate(): number {
    return this.costPerRequest;
  }

  /**
   * Check if API is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Mock profile data for testing
   */
  private getMockProfile(): ProxycurlProfile {
    this.logger.warn('Using mock LinkedIn profile data (API key not configured)');

    return {
      public_identifier: 'john-doe',
      profile_pic_url: 'https://media.linkedin.com/dms/image/photo.jpg',
      first_name: 'John',
      last_name: 'Doe',
      headline: 'Senior Software Engineer at Google',
      summary: 'Experienced software engineer with 10+ years in building scalable systems.',
      country_full_name: 'United States',
      city: 'San Francisco',
      experiences: [
        {
          company: 'Google',
          title: 'Senior Software Engineer',
          description: 'Leading backend development for cloud infrastructure.',
          starts_at: { year: 2020, month: 1 },
          ends_at: null,
        },
        {
          company: 'Microsoft',
          title: 'Software Engineer',
          description: 'Built scalable cloud services.',
          starts_at: { year: 2015, month: 6 },
          ends_at: { year: 2020, month: 1 },
        },
        {
          company: 'Amazon',
          title: 'Software Development Engineer',
          description: 'E-commerce platform development.',
          starts_at: { year: 2013, month: 3 },
          ends_at: { year: 2015, month: 6 },
        },
      ],
      education: [
        {
          school: 'Stanford University',
          degree_name: 'Bachelor of Science',
          field_of_study: 'Computer Science',
          starts_at: { year: 2011, month: 9 },
          ends_at: { year: 2015, month: 6 },
        },
      ],
      skills: [
        'JavaScript',
        'TypeScript',
        'Node.js',
        'React',
        'System Design',
        'Cloud Architecture',
        'Kubernetes',
        'Docker',
      ],
    };
  }
}
