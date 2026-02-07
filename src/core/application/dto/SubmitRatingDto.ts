import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsUUID,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SubmitRatingDto {
  @ApiProperty({ example: 'esc_abc123' })
  @IsUUID()
  escrow_id: string;

  @ApiProperty({ example: 'usr_xyz789', description: 'User being rated' })
  @IsUUID()
  rated_user_id: string;

  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  @IsNumber()
  @Min(1)
  @Max(5)
  overall_rating: number;

  @ApiProperty({ example: 5, minimum: 1, maximum: 5, required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  communication_rating?: number;

  @ApiProperty({ example: 5, minimum: 1, maximum: 5, required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  quality_rating?: number;

  @ApiProperty({ example: 5, minimum: 1, maximum: 5, required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  professionalism_rating?: number;

  @ApiProperty({ example: 5, minimum: 1, maximum: 5, required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  timeliness_rating?: number;

  @ApiProperty({
    example: 'Excellent work, delivered on time!',
    required: false,
  })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiProperty({
    example: 'Could improve response time',
    required: false,
    description: 'Private feedback only visible to admins',
  })
  @IsOptional()
  @IsString()
  private_feedback?: string;
}
