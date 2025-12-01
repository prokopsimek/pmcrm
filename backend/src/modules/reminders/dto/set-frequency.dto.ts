import { IsInt, Min, Max } from 'class-validator';

export class SetFrequencyDto {
  @IsInt()
  @Min(1)
  @Max(365)
  frequencyDays: number;
}
