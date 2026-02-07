import { IsString, IsOptional, IsArray, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiProperty({ example: 'John Smith', required: false })
  @IsOptional()
  @IsString()
  full_name?: string;

  @ApiProperty({
    example: 'Experienced web developer specializing in React and Node.js',
    required: false,
  })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiProperty({ example: 'America/Los_Angeles', required: false })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiProperty({ example: 'United States', required: false })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({ example: 'English', required: false })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiProperty({
    example: ['Web Development', 'React', 'Node.js', 'TypeScript'],
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @ApiProperty({
    example: 'https://example.com/profile.jpg',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  profile_picture_url?: string;

  @ApiProperty({
    example: {
      email_escrow_updates: true,
      email_dispute_updates: true,
      email_payment_received: true,
    },
    required: false,
  })
  @IsOptional()
  notification_preferences?: {
    email_escrow_updates?: boolean;
    email_dispute_updates?: boolean;
    email_payment_received?: boolean;
  };
}
