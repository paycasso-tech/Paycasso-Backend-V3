import {
  IsOptional,
  IsString,
  IsEnum,
  IsNumber,
  Min,
  Max,
  IsArray,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { UserRole } from '../../domain/entities/User.entity';

export class SearchUsersDto {
  @ApiProperty({
    example: 'web developer',
    required: false,
    description: 'Search in name, bio, skills',
  })
  @IsOptional()
  @IsString()
  query?: string;

  @ApiProperty({
    example: 'freelancer',
    enum: ['client', 'freelancer'],
    required: false,
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiProperty({ example: 4.5, required: false, minimum: 0, maximum: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  min_trust_score?: number;

  @ApiProperty({
    example: ['Web Development', 'React'],
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @ApiProperty({ example: 'United States', required: false })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({ example: 1, required: false, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    example: 20,
    required: false,
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiProperty({
    example: 'trust_score',
    required: false,
    enum: [
      'trust_score',
      '-trust_score',
      'created_at',
      '-created_at',
      'completed_contracts',
      '-completed_contracts',
    ],
  })
  @IsOptional()
  @IsString()
  sort?: string = '-trust_score';
}
