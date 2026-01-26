import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './interfaces/http/controllers/AuthController';
import { AuthService } from './core/application/services/AuthService';
import { EmailService } from './core/application/services/EmailService';
import { User } from './core/domain/entities/User.entity';
import { OtpToken } from './core/domain/entities/OtpToken.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, OtpToken]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('jwt.secret'),
        signOptions: {
          expiresIn: configService.get('jwt.expiresIn'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, EmailService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
