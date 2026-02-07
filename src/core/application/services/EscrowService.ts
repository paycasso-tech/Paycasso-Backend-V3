import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Escrow, EscrowStatus } from '../../domain/entities/Escrow.entity';
import {
  Transaction,
  TransactionType,
  TransactionStatus,
} from '../../domain/entities/Transaction.entity';
import { User } from '../../domain/entities/User.entity';
import { BlockchainService } from './BlockchainService';
import { randomUUID } from 'crypto';

@Injectable()
export class EscrowService {
  private readonly logger = new Logger(EscrowService.name);

  constructor(
    @InjectRepository(Escrow)
    private escrowRepository: Repository<Escrow>,
    @InjectRepository(Transaction)
    private txRepository: Repository<Transaction>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private blockchainService: BlockchainService,
  ) {}

  async createEscrow(userId: string, data: any) {
    const buyer = await this.userRepository.findOne({ where: { id: userId } });
    if (!buyer) throw new BadRequestException('Buyer not found');

    // Find seller by email or wallet
    let seller = await this.userRepository.findOne({
      where: { email: data.seller_email_or_wallet },
    });
    if (!seller) {
      seller = await this.userRepository.findOne({
        where: { wallet_address: data.seller_email_or_wallet },
      });
    }

    if (!seller) {
      // Option: create a pending user invite? For now throw error
      throw new BadRequestException('Seller not found');
    }

    if (seller.id === buyer.id) {
      throw new BadRequestException('Cannot create escrow with yourself');
    }

    // Generate readable number
    const escrowNumber = `ESC-${new Date().getFullYear()}-${Math.floor(
      Math.random() * 100000,
    )
      .toString()
      .padStart(6, '0')}`;

    const escrow = this.escrowRepository.create({
      escrow_number: escrowNumber,
      buyer_id: buyer.id,
      seller_id: seller.id,
      buyer_wallet_address: buyer.wallet_address || 'TBD', // Should enforce wallet existence
      seller_wallet_address: seller.wallet_address || 'TBD',
      amount: data.amount,
      currency: data.currency,
      network: data.network,
      token_address: '0x...', // Fetch from config based on currency
      title: data.title,
      description: data.description,
      status: EscrowStatus.CREATED,
      substatus: 'pending_deposit',
      platform_fee_percentage: 2.5,
    });

    return this.escrowRepository.save(escrow);
  }

  async getEscrow(escrowId: string) {
    return this.escrowRepository.findOne({
      where: { id: escrowId },
      relations: ['buyer', 'seller', 'transactions'],
    });
  }

  async registerDeposit(escrowId: string, txHash: string, fromAddress: string) {
    const escrow = await this.getEscrow(escrowId);
    if (!escrow) throw new NotFoundException('Escrow not found');

    // Verify on blockchain
    const txInfo = await this.blockchainService.verifyTransaction(txHash);
    if (!txInfo.exists)
      throw new BadRequestException('Transaction not found on chain');

    // Create TX record
    const tx = this.txRepository.create({
      escrow_id: escrow.id,
      user_id: escrow.buyer_id, // Assuming buyer deposited
      tx_hash: txHash,
      from_address: fromAddress,
      to_address: txInfo.to,
      amount: txInfo.value || escrow.amount, // Use parsed value
      network: escrow.network,
      tx_type: TransactionType.DEPOSIT,
      status: txInfo.confirmed
        ? TransactionStatus.CONFIRMED
        : TransactionStatus.PENDING,
      confirmations: txInfo.confirmations,
    });

    await this.txRepository.save(tx);

    if (txInfo.confirmed) {
      escrow.status = EscrowStatus.FUNDED;
      escrow.funded_at = new Date();
      escrow.deposit_tx_hash = txHash;
      await this.escrowRepository.save(escrow);
    }

    return tx;
  }
}
