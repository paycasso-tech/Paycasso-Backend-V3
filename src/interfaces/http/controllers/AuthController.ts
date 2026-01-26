import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from '../../../core/application/services/AuthService';
import { SignUpDto } from '../../../core/application/dto/SignUpDto';
import { SignInDto } from '../../../core/application/dto/SignInDto';
import { VerifyEmailDto } from '../../../core/application/dto/VerifyEmailDto';
import { AuthResponseDto } from '../../../core/application/dto/AuthResponseDto';

@ApiTags('Auth')
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ 
    status: 201, 
    description: 'Verification email sent',
    schema: {
      example: {
        status: 'success',
        message: 'Verification email sent',
        data: {
          user_id: 'uuid',
          email: 'user@example.com',
          verification_required: true,
        }
      }
    }
  })
  async signUp(@Body() signUpDto: SignUpDto) {
    return this.authService.signUp(signUpDto);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email with OTP' })
  @ApiResponse({ 
    status: 200, 
    description: 'Email verified successfully',
    type: AuthResponseDto 
  })
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.authService.verifyEmail(verifyEmailDto);
  }

  @Post('signin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in user' })
  @ApiResponse({ 
    status: 200, 
    description: 'Login successful',
    type: AuthResponseDto
  })
  async signIn(@Body() signInDto: SignInDto) {
    return this.authService.signIn(signInDto);
  }
}
