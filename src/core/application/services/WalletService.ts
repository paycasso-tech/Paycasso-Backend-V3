import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wallet } from '../../domain/entities/Wallet.entity';
import { User } from '../../domain/entities/User.entity';
import { Transaction, TransactionType } from '../../domain/entities/Transaction.entity';
import { Escrow, EscrowStatus } from '../../domain/entities/Escrow.entity';
import { ConnectWalletDto } from '../dto/Wallet.dto';
import { BlockchainService } from './BlockchainService';
import { ethers } from 'ethers';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Transaction)
    private txRepository: Repository<Transaction>,
    @InjectRepository(Escrow)
    private escrowRepository: Repository<Escrow>,
    private blockchainService: BlockchainService,
  ) { }

  async connectWallet(userId: string, connectDto: ConnectWalletDto): Promise<any> {
    const { wallet_address, signature, message, provider, cdp_wallet_id } = connectDto;

    // Verify signature
    const isValid = await this.verifySignature(wallet_address, signature, message);
    if (!isValid) {
      throw new BadRequestException('Invalid signature');
    }

    // Check if wallet is already connected to another user
    const existingWallet = await this.walletRepository.findOne({
      where: { address: wallet_address },
    });

    if (existingWallet && existingWallet.user_id !== userId) {
      throw new ConflictException('Wallet already connected to another account');
    }

    // Check if user already has a wallet
    let userWallet = await this.walletRepository.findOne({
      where: { user_id: userId },
    });

    if (!userWallet) {
      // Create new wallet
      userWallet = this.walletRepository.create({
        user_id: userId,
        address: wallet_address,
        network: 'base', // You can make this dynamic
        is_primary: true,
        metadata: { provider, cdp_wallet_id },
      });
      await this.walletRepository.save(userWallet);

      // Update user's wallet address
      await this.userRepository.update(userId, {
        wallet_address: wallet_address,
        wallet_created_at: new Date(),
      });
    } else {
      // Update existing wallet
      userWallet.address = wallet_address;
      userWallet.metadata = { ...userWallet.metadata, provider, ...(cdp_wallet_id && { cdp_wallet_id }) };
      await this.walletRepository.save(userWallet);

      await this.userRepository.update(userId, {
        wallet_address: wallet_address,
      });
    }

    return {
      success: true,
      wallet_address,
      network: 'base',
      verified: true,
    };
  }

  async getWalletInfo(userId: string): Promise<any> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user || !user.wallet_address) {
      throw new NotFoundException('Wallet not found');
    }

    // Get balances from blockchain
    const balances = await this.blockchainService.getBalances(user.wallet_address);

    // Calculate escrow amounts
    const escrowTotal = await this.calculateTotalInEscrow(userId);

    return {
      wallet_address: user.wallet_address,
      network: 'base',
      balances: {
        usdc: balances.usdc || '0',
        eth: balances.native || '0',
      },
      platform_escrow_wallet: '0x9f8c163cBA728b4fA5b929b0d7C37e1E1c3d38aF',
      total_in_escrow: escrowTotal,
      available_to_withdraw: Math.max(0, parseFloat(balances.usdc || '0') - escrowTotal),
    };
  }

  async disconnectWallet(userId: string): Promise<{ success: boolean }> {
    // Check for active escrows
    const hasActiveEscrows = await this.checkActiveEscrows(userId);

    if (hasActiveEscrows) {
      throw new BadRequestException('Cannot disconnect wallet with active escrows');
    }

    // Remove wallet
    await this.walletRepository.delete({ user_id: userId });
    await this.userRepository.update(userId, {
      wallet_address: null,
    });

    return { success: true };
  }

  async getTransactionHistory(
    userId: string,
    filters: any,
  ): Promise<{ transactions: Transaction[]; total: number }> {
    const { type = 'all', status, page = 1, limit = 20 } = filters;

    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user || !user.wallet_address) {
      throw new NotFoundException('Wallet not found');
    }

    const queryBuilder = this.txRepository
      .createQueryBuilder('tx')
      .leftJoinAndSelect('tx.escrow', 'escrow')
      .where('(tx.from_address = :address OR tx.to_address = :address)', {
        address: user.wallet_address,
      });

    if (type !== 'all') {
      const typeMapping: Record<string, TransactionType[]> = {
        deposit: [TransactionType.DEPOSIT],
        withdrawal: [TransactionType.WITHDRAWAL],
        escrow_fund: [TransactionType.ESCROW_FUND],
        escrow_release: [TransactionType.ESCROW_RELEASE],
      };

      if (typeMapping[type]) {
        queryBuilder.andWhere('tx.tx_type IN (:...types)', { types: typeMapping[type] });
      }
    }

    if (status) {
      queryBuilder.andWhere('tx.status = :status', { status });
    }

    const [transactions, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('tx.created_at', 'DESC')
      .getManyAndCount();

    return { transactions, total };
  }

  async verifyTransaction(txHash: string): Promise<any> {
    const txInfo = await this.blockchainService.verifyTransaction(txHash);

    if (!txInfo.exists) {
      throw new NotFoundException('Transaction not found on blockchain');
    }

    return {
      tx_hash: txHash,
      from_address: txInfo.from,
      to_address: txInfo.to,
      amount: txInfo.value,
      status: txInfo.confirmed ? 'confirmed' : 'pending',
      confirmations: txInfo.confirmations,
      block_number: txInfo.blockNumber,
      timestamp: txInfo.timestamp,
    };
  }

  public async verifySignature(
    address: string,
    signature: string,
    message: string,
  ): Promise<boolean> {
    try {
      if (!signature || !message) return false;

      const recoveredAddress = ethers.verifyMessage(message, signature);
      return recoveredAddress.toLowerCase() === address.toLowerCase();
    } catch (error) {
      return false;
    }
  }

  private async calculateTotalInEscrow(userId: string): Promise<number> {
    // Sum amounts of escrows where user is buyer and status is PENDING_FUNDING or FUNDED or IN_PROGRESS
    // If FUNDED/IN_PROGRESS/COMPLETED, money is already out of wallet, so maybe don't count?
    // "Total in escrow" usually means total value currently locked in escrow contracts.

    // We'll count escrows where user is buyer that are funded or in progress.
    const statuses = [
      EscrowStatus.FUNDED,
      EscrowStatus.IN_PROGRESS,
      EscrowStatus.DISPUTED
    ];

    const result = await this.escrowRepository
      .createQueryBuilder('escrow')
      .select('SUM(escrow.amount)', 'total')
      .where('escrow.buyer_id = :userId', { userId })
      .andWhere('escrow.status IN (:...statuses)', { statuses })
      .getRawOne();

    return parseFloat(result?.total || '0');
  }

  private async checkActiveEscrows(userId: string): Promise<boolean> {
    // Check if user has any active escrows where they are buyer or seller
    // Active = anything not final
    const inactiveStatuses = [
      EscrowStatus.DRAFT,
      EscrowStatus.COMPLETED,
      EscrowStatus.RELEASED,
      EscrowStatus.CANCELLED,
      EscrowStatus.REJECTED
    ];

    const count = await this.escrowRepository
      .createQueryBuilder('escrow')
      .where('(escrow.buyer_id = :userId OR escrow.seller_id = :userId)', { userId })
      .andWhere('escrow.status NOT IN (:...inactiveStatuses)', { inactiveStatuses })
      .getCount();

    return count > 0;
  }
}
