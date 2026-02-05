import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';

@Injectable()
export class BlockchainService {
  private provider: ethers.JsonRpcProvider;
  private readonly logger = new Logger(BlockchainService.name);

  constructor(private configService: ConfigService) {
    this.initializeProvider();
  }

  private initializeProvider() {
    const rpcUrl = this.configService.get('BLOCKCHAIN_RPC_URL');
    if (rpcUrl) {
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      this.logger.log(`🔗 Blockchain Provider connected: ${rpcUrl}`);
    } else {
        this.logger.warn('Blockchain RPC URL not configured.');
    }
  }

  async verifyTransaction(txHash: string): Promise<any> {
    try {
      if (!this.provider) throw new Error('Provider not initialized');

      const tx = await this.provider.getTransaction(txHash);
      if (!tx) return { exists: false };

      const receipt = await this.provider.getTransactionReceipt(txHash);
      
      return {
        exists: true,
        confirmed: receipt && receipt.status === 1,
        confirmations: receipt ? await receipt.confirmations() : 0,
        from: tx.from,
        to: tx.to,
        value: ethers.formatUnits(tx.value, 18), // assuming ETH/Native
        blockNumber: receipt?.blockNumber
      };
    } catch (error) {
      this.logger.error(`Failed to verify tx ${txHash}:`, error);
      throw error;
    }
  }

  // Monitor logs for specific contract events (deposit/release)
  // Logic would go here
}
