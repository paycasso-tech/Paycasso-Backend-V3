import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../domain/entities/User.entity';

class UserResponse {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ enum: UserRole, example: UserRole.CLIENT })
  role: UserRole;

  @ApiProperty({ example: true })
  email_verified: boolean;
}

export class AuthResponseData {
  @ApiProperty({ example: 'eyJh...' })
  access_token: string;

  @ApiProperty({ example: 'eyJh...' })
  refresh_token: string;

  @ApiProperty({ example: 3600 })
  expires_in: number;

  @ApiProperty({ type: UserResponse })
  user: UserResponse;
}

export class AuthResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ type: AuthResponseData })
  data: AuthResponseData;
}
