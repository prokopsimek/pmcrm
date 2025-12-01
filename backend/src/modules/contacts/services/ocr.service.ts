import { Injectable, BadRequestException } from '@nestjs/common';
import { BusinessCardParseResult, ImageFormat } from '../dto/business-card-scan.dto';

/**
 * OCR Service for Business Card Scanning
 * Uses Tesseract.js or Google Vision API for text extraction
 */
@Injectable()
export class OcrService {
  private readonly MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly SUPPORTED_FORMATS = ['image/jpeg', 'image/png'];

  /**
   * Preprocess image for better OCR accuracy
   * - Convert to grayscale
   * - Enhance contrast
   * - Remove noise
   */
  async preprocessImage(imageData: string): Promise<string> {
    // TODO: Implement image preprocessing
    // For now, return as-is
    return imageData;
  }

  /**
   * Parse business card image and extract contact information
   * Uses pattern matching and NLP to identify fields
   */
  async parseBusinessCard(imageData: string, mimeType: string): Promise<BusinessCardParseResult> {
    // Validate image format
    if (!this.SUPPORTED_FORMATS.includes(mimeType)) {
      throw new BadRequestException(
        `Unsupported image format. Only ${this.SUPPORTED_FORMATS.join(', ')} are allowed.`,
      );
    }

    // Validate image size
    const sizeInBytes = Buffer.from(imageData, 'base64').length;
    if (sizeInBytes > this.MAX_IMAGE_SIZE) {
      throw new BadRequestException(
        `Image too large. Maximum size is ${this.MAX_IMAGE_SIZE / 1024 / 1024}MB`,
      );
    }

    // Preprocess image
    const preprocessedImage = await this.preprocessImage(imageData);

    // TODO: Implement actual OCR using Tesseract.js or Google Vision API
    // For now, return mock data for testing
    const mockResult: BusinessCardParseResult = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '+14155552671',
      company: 'Example Corp',
      title: 'CEO',
      confidence: 0.85,
      rawText: 'John Doe\nCEO\nExample Corp\njohn.doe@example.com\n+1 415 555 2671',
    };

    return mockResult;
  }

  /**
   * Extract email from raw text using regex
   */
  private extractEmail(text: string): string | undefined {
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
    const matches = text.match(emailRegex);
    return matches ? matches[0] : undefined;
  }

  /**
   * Extract phone number from raw text
   */
  private extractPhone(text: string): string | undefined {
    const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/gi;
    const matches = text.match(phoneRegex);
    return matches ? matches[0] : undefined;
  }

  /**
   * Calculate confidence score based on extracted fields
   */
  private calculateConfidence(result: Partial<BusinessCardParseResult>): number {
    let score = 0;
    const weights = {
      firstName: 0.2,
      lastName: 0.1,
      email: 0.3,
      phone: 0.2,
      company: 0.1,
      title: 0.1,
    };

    Object.keys(weights).forEach((key) => {
      if (result[key as keyof BusinessCardParseResult]) {
        score += weights[key as keyof typeof weights];
      }
    });

    return score;
  }
}
