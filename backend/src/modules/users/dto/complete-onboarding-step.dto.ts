/**
 * DTO for completing an onboarding step
 * US-001: Registration and workspace creation
 */
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsIn } from 'class-validator';

export class CompleteOnboardingStepDto {
  @ApiProperty({
    description: 'Onboarding step to complete',
    example: 'profile',
    enum: ['profile', 'integrations', 'import_contacts'],
  })
  @IsString()
  @IsIn(['profile', 'integrations', 'import_contacts'], {
    message: 'Invalid onboarding step',
  })
  step: 'profile' | 'integrations' | 'import_contacts';
}
