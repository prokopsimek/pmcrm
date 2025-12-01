import { IsArray, IsInt, Min, Max, ArrayMinSize } from 'class-validator';

export class BulkFrequencyDto {
  @IsArray()
  @ArrayMinSize(1)
  tags: string[];

  @IsInt()
  @Min(1)
  @Max(365)
  frequencyDays: number;
}
