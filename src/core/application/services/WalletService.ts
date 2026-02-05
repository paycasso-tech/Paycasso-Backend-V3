import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wallet, WalletStatus } from '../../domain/entities/Wallet.entity';
import { User } from '../../domain/entities/User.entity';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async registerWallet(userId: string, address: string, network: string, metadata: any) {
    const existingWallet = await this.walletRepository.findOne({
      where: { address, network }
    });

    if (existingWallet) {
      if (existingWallet.user_id !== userId) {
        throw new ConflictException('Wallet address already registered by another user');
      }
      return existingWallet; // Idempotent success
    }

    // Check if user has other wallets
    const userWalletsCount = await this.walletRepository.count({ where: { user_id: userId } });
    const isPrimary = userWalletsCount === 0;

    const wallet = this.walletRepository.create({
      user_id: userId,
      address,
      network,
      is_primary: isPrimary,
      metadata,
      status: WalletStatus.ACTIVE
    });

    await this.walletRepository.save(wallet);

    // Update user's convenience fields if primary
    if (isPrimary) {
      await this.userRepository.update(userId, {
        wallet_address: address,
        wallet_created_at: new Date(),
      });
    }

    return wallet;
  }

  async getUserWallets(userId: string) {
    return this.walletRepository.find({
      where: { user_id: userId },
      order: { is_primary: 'DESC', created_at: 'DESC' }
    });
  }

  async verifyOwnership(userId: string, address: string, signature: string, message: string) {
    // TODO: Use ethers.verifyMessage(message, signature) === address
    // For now, mock success
    return { verified: true, verified_at: new Date() };
  }
}
