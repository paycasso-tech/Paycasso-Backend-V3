import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { UserProfileController } from './interfaces/http/controllers/UserProfileController';
import { UserProfileService } from './core/application/services/UserProfileService';
import { User } from './core/domain/entities/User.entity';
import { Rating } from './core/domain/entities/Rating.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Rating]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  controllers: [UserProfileController],
  providers: [UserProfileService],
  exports: [UserProfileService],
})
export class UserProfileModule {}
