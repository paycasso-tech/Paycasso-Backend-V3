import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './interfaces/http/controllers/UserController';
import { User } from './core/domain/entities/User.entity';
import { WalletModule } from './Wallet.module';
import { EscrowModule } from './Escrow.module';
import { DisputeModule } from './Dispute.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([User]),
        WalletModule,
        EscrowModule,
        DisputeModule,
    ],
    controllers: [UserController],
    providers: [],
    exports: [],
})
export class UserModule { }
