import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, ILike } from 'typeorm';
import { Dispute, DisputeStatus } from '../../domain/entities/Dispute.entity';
import { Escrow, EscrowStatus } from '../../domain/entities/Escrow.entity';
import { User } from '../../domain/entities/User.entity';
import * as DisputeArtifact from '../../../abis/TFADispute.json';
import * as DAOVotingArtifact from '../../../abis/TFADAOVoting.json';
import { Coinbase, Wallet } from '@coinbase/coinbase-sdk';

const statusMap: Record<number, string> = {
  0: 'Active',
  1: 'DisputeRaised',
  2: 'AIResolved',
  3: 'DAOEscalated',
  4: 'Resolved'
};

@Injectable()
export class BlockchainService implements OnModuleInit {
  private provider: ethers.JsonRpcProvider | ethers.WebSocketProvider;
  private disputeContract: ethers.Contract;
  private daoContract: ethers.Contract;

  private aiWalletId: string;
  private adminWalletId: string;

  private readonly logger = new Logger(BlockchainService.name);

  constructor(
    private configService: ConfigService,
    @InjectRepository(Dispute)
    private disputeRepository: Repository<Dispute>,
    @InjectRepository(Escrow)
    private escrowRepository: Repository<Escrow>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) { }

  onModuleInit() {
    this.initializeBlockchain();
    this.initializeListeners();
  }

  private initializeBlockchain() {
    const rpcUrl = this.configService.get('BLOCKCHAIN_RPC_URL');
    const wssUrl = this.configService.get('BASE_WSS_URL');

    // Coinbase SDK Configuration (Server Wallet v2)
    const apiKeyName = this.configService.get('COINBASE_API_KEY_NAME');
    const privateKey = this.configService.get('COINBASE_API_KEY_SECRET_KEY')?.replace(/\\n/g, '\n');

    if (apiKeyName && privateKey) {
      Coinbase.configure({ apiKeyName, privateKey });
      this.logger.log(' Coinbase SDK Configured (V2)');
    } else {
      this.logger.warn(' Coinbase API Keys missing from configuration');
    }

    this.aiWalletId = this.configService.get('AI_WALLET_ID')!;
    this.adminWalletId = this.configService.get('ADMIN_WALLET_ID')!;

    if (wssUrl) {
      this.provider = new ethers.WebSocketProvider(wssUrl);
      this.logger.log(` Blockchain Provider connected via WSS: ${wssUrl}`);
    } else if (rpcUrl) {
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      this.logger.log(` Blockchain Provider connected via RPC: ${rpcUrl}`);
    } else {
      this.logger.warn('Blockchain provider not configured. Smart contract interactions will fail.');
      return;
    }

    const disputeAddress = this.configService.get('TFA_DISPUTE_ADDRESS');
    const daoAddress = this.configService.get('TFA_DAO_VOTING_ADDRESS');

    if (!disputeAddress || !daoAddress) {
      this.logger.warn('Contract addresses missing. Listeners not started.');
      return;
    }

    // Initialize Read-only Contracts (Use provider)
    this.disputeContract = new ethers.Contract(disputeAddress, DisputeArtifact.abi, this.provider);
    this.daoContract = new ethers.Contract(daoAddress, DAOVotingArtifact.abi, this.provider);
  }

  private initializeListeners() {
    this.logger.log(' Initializing Smart Contract Listeners...');

    // 1. Job Created (Escrow Funded)
    this.disputeContract.on('JobCreated', async (id, client, contractor, amount, event) => {
      try {
        const jobId = Number(id);
        const txHash = event?.log?.transactionHash || event?.transactionHash;
        this.logger.log(`Event: JobCreated [${jobId}] Client: ${client} Tx: ${txHash}`);

        // Update Escrow with On-Chain ID
        let escrow: Escrow | null = null;
        const amountReadable = parseFloat(ethers.formatUnits(amount, 6));

        if (txHash) {
          escrow = await this.escrowRepository.findOne({ where: { deposit_tx_hash: txHash } });
        }

        // Fallback: match by client address and amount (approximate)
        if (!escrow) {
          this.logger.log(`Searching for Escrow: client=${client}, amount=${amountReadable}`);
          const candidates = await this.escrowRepository.find({
            where: {
              buyer_wallet_address: ILike(client),
              status: In([EscrowStatus.PENDING_FUNDING, EscrowStatus.FUNDED])
            }
          });

          this.logger.log(`Found ${candidates.length} candidate escrows for address ${client}. Checking amounts...`);
          escrow = candidates.find(c => Math.abs(parseFloat(c.amount) - amountReadable) < 0.01) || null;

          if (!escrow && candidates.length > 0) {
            this.logger.warn(`None of the ${candidates.length} candidates matched amount ${amountReadable}. Candidate amounts: ${candidates.map(c => c.amount).join(', ')}`);
          }
        }

        if (escrow) {
          await this.escrowRepository.update(escrow.id, { on_chain_job_id: jobId });
          this.logger.log(` Linked Escrow ${escrow.id} to JobID ${jobId}`);
        } else {
          this.logger.warn(` Could not link JobID ${jobId} to any Escrow. Check address/amount mismatch.`);
        }
      } catch (e) {
        this.logger.error('Error processing JobCreated:', e);
      }
    });

    // 2. Dispute Raised
    this.disputeContract.on('DisputeRaised', async (id, raisedBy) => {
      try {
        const jobId = Number(id);
        this.logger.log(`Event: DisputeRaised [${jobId}] By: ${raisedBy}`);

        const escrow = await this.escrowRepository.findOne({ where: { on_chain_job_id: jobId } });
        if (escrow) {
          await this.escrowRepository.update(escrow.id, {
            has_active_dispute: true,
            status: EscrowStatus.DISPUTED
          });

          // Create or Update Dispute Record
          let dispute = await this.disputeRepository.findOne({ where: { escrowId: escrow.id } });

          // Lookup user by wallet address
          const raiser = await this.userRepository.findOne({
            where: { wallet_address: ILike(raisedBy) }
          });

          if (!dispute) {
            if (raiser) {
              let raisedByRole = 'client';
              if (raiser.id === escrow.seller_id) raisedByRole = 'freelancer';

              dispute = this.disputeRepository.create({
                escrowId: escrow.id,
                raisedById: raiser.id,
                raisedByRole: raisedByRole,
                status: DisputeStatus.AI_ANALYSIS,
                reason: 'other' as any,
                description: 'Dispute raised via smart contract',
                desiredOutcome: 'mediation' as any,
                amountInDispute: parseFloat(escrow.amount),
                clientStakeUsdc: 0,
                freelancerStakeUsdc: 0,
                totalStaked: 0,
                platformCommission: 0
              });
              await this.disputeRepository.save(dispute);
              this.logger.log(` Created Dispute record for Escrow ${escrow.id}`);
            } else {
              this.logger.warn(`️ Could not find user with wallet ${raisedBy} to assign as raiser`);
            }
          } else {
            await this.disputeRepository.update(dispute.id, { status: DisputeStatus.AI_ANALYSIS });
            this.logger.log(` Updated Dispute status for Escrow ${escrow.id}`);
          }

          if (dispute) {
            // AI Agent Trigger (Mock AI Verdict)
            setTimeout(async () => {
              try {
                this.logger.log(` AI Agent Analyzing Dispute for Job ${jobId}...`);
                const verdictPercent = 50;
                const reason = "AI Analysis: Evidence suggests split responsibility.";
                await this.submitAIVerdict(jobId, verdictPercent, reason);

                // Update to Verdict Review
                const d = await this.disputeRepository.findOne({ where: { id: dispute!.id } });
                if (d) {
                  await this.disputeRepository.update(d.id, {
                    status: DisputeStatus.AI_VERDICT_REVIEW,
                    clientPercentage: 100 - verdictPercent,
                    freelancerPercentage: verdictPercent,
                    resolutionNotes: reason,
                  });
                }
                this.logger.log(` AI Verdict Submitted for Job ${jobId}`);
              } catch (err) {
                this.logger.error(` AI Agent failed for Job ${jobId}`, err);
              }
            }, 5000); // 5s delay
          } else {
            this.logger.error(` Cannot trigger AI Agent: No Dispute record found/created for Job ${jobId}`);
          }
        } else {
          this.logger.warn(`️ DisputeRaised for Job ${jobId} ignored: Could not find linked Escrow record`);
        }
      } catch (e) {
        this.logger.error('Error processing DisputeRaised:', e);
      }
    });

    // 3. Funds Released
    this.disputeContract.on('FundsReleased', async (id, to, amount) => {
      try {
        const jobId = Number(id);
        this.logger.log(`Event: FundsReleased [${jobId}] To: ${to}`);

        const escrow = await this.escrowRepository.findOne({ where: { on_chain_job_id: jobId } });
        if (escrow) {
          await this.escrowRepository.update(escrow.id, {
            status: EscrowStatus.RELEASED,
            released_at: new Date()
          });

          // Resolve dispute if exists
          const dispute = await this.disputeRepository.findOne({ where: { escrowId: escrow.id } });
          if (dispute) {
            await this.disputeRepository.update(dispute.id, {
              status: DisputeStatus.RESOLVED,
              resolvedAt: new Date()
            });
          }
        }
      } catch (e) {
        this.logger.error('Error processing FundsReleased:', e);
      }
    });

    // 4. Voting Finalized
    this.daoContract.on('VotingFinalized', async (jobId, consensusPercent, mad) => {
      try {
        const jId = Number(jobId);
        this.logger.log(`Event: VotingFinalized [${jId}] Consensus: ${consensusPercent}%`);
        // We rely on FundsReleased to update final status, but we can log or update Dispute state
        const escrow = await this.escrowRepository.findOne({ where: { on_chain_job_id: jId } });
        if (escrow) {
          const dispute = await this.disputeRepository.findOne({ where: { escrowId: escrow.id } });
          if (dispute) {
            await this.disputeRepository.update(dispute.id, {
              resolutionNotes: `DAO Consensus: ${consensusPercent}%`
            });
          }
        }
      } catch (e) {
        this.logger.error('Error processing VotingFinalized:', e);
      }
    });

    // 5. AI Verdict Accepted
    this.disputeContract.on('AIVerdictAccepted', async (id, acceptedBy) => {
      this.logger.log(`Event: AIVerdictAccepted [${id}] By: ${acceptedBy}`);
      // Optional: notification logic
    });

    // 6. Dispute Resolved (Layer 1 or Final)
    this.disputeContract.on('DisputeResolved', async (id, percent) => {
      try {
        const jobId = Number(id);
        this.logger.log(`Event: DisputeResolved [${jobId}] Contractor Percent: ${percent}%`);

        const escrow = await this.escrowRepository.findOne({ where: { on_chain_job_id: jobId } });
        if (escrow) {
          escrow.status = EscrowStatus.RELEASED;
          escrow.released_at = new Date();
          await this.escrowRepository.save(escrow);

          const dispute = await this.disputeRepository.findOne({ where: { escrowId: escrow.id } });
          if (dispute) {
            dispute.status = DisputeStatus.RESOLVED;
            dispute.freelancerPercentage = Number(percent);
            dispute.clientPercentage = 100 - Number(percent);
            dispute.resolvedAt = new Date();
            await this.disputeRepository.save(dispute);
          }
        }
      } catch (error) {
        this.logger.error('Error processing DisputeResolved:', error);
      }
    });

    // 7. DAO Escalated
    this.disputeContract.on('EscalatedToDAO', async (id) => {
      const jobId = Number(id);
      this.logger.log(`Event: EscalatedToDAO [${jobId}]`);
      const escrow = await this.escrowRepository.findOne({ where: { on_chain_job_id: jobId } });
      if (escrow) {
        const dispute = await this.disputeRepository.findOne({ where: { escrowId: escrow.id } });
        if (dispute) {
          dispute.status = DisputeStatus.DAO_VOTING;
          await this.disputeRepository.save(dispute);
        }
      }
    });
  }

  // --- Admin / System Actions ---

  // --- Helper to get Ethers Wallet from Private Key ---

  private getAdminWallet(): ethers.Wallet {
    const pk = this.configService.get('ADMIN_WALLET_PRIVATE_KEY');
    if (!pk) throw new Error('ADMIN_WALLET_PRIVATE_KEY not configured');
    return new ethers.Wallet(pk, this.provider);
  }

  private getAIWallet(): ethers.Wallet {
    const pk = this.configService.get('AI_WALLET_PRIVATE_KEY');
    if (!pk) throw new Error('AI_WALLET_PRIVATE_KEY not configured');
    return new ethers.Wallet(pk, this.provider);
  }

  // --- Admin / System Actions ---

  async escalateToDAO(jobId: number, durationSeconds: number = 86400) {
    try {
      const wallet = this.getAdminWallet();
      const contract = new ethers.Contract(
        this.configService.get('TFA_DAO_VOTING_ADDRESS')!,
        DAOVotingArtifact.abi,
        wallet
      );

      const tx = await contract.startVoting(jobId, durationSeconds);
      await tx.wait();
      return tx.hash;
    } catch (e) {
      this.logger.error('escalateToDAO failed:', e);
      throw e;
    }
  }

  async checkAIDeadline(jobId: number) {
    try {
      const wallet = this.getAIWallet();
      const contract = new ethers.Contract(
        this.configService.get('TFA_DISPUTE_ADDRESS')!,
        DisputeArtifact.abi,
        wallet
      );

      const tx = await contract.checkAIDeadline(jobId);
      await tx.wait();
      return tx.hash;
    } catch (e) {
      this.logger.error('checkAIDeadline failed:', e);
      throw e;
    }
  }

  async finalizeVoting(jobId: number) {
    try {
      const wallet = this.getAIWallet(); // Or Admin, depending on role
      const contract = new ethers.Contract(
        this.configService.get('TFA_DAO_VOTING_ADDRESS')!,
        DAOVotingArtifact.abi,
        wallet
      );

      const tx = await contract.finalizeVoting(jobId);
      await tx.wait();
      return tx.hash;
    } catch (e) {
      this.logger.error('finalizeVoting failed:', e);
      throw e;
    }
  }

  async submitAIVerdict(jobId: number, percent: number, reason: string) {
    try {
      const wallet = this.getAIWallet();
      const contract = new ethers.Contract(
        this.configService.get('TFA_DISPUTE_ADDRESS')!,
        DisputeArtifact.abi,
        wallet
      );

      // _jobId, _contractorPercent, _explanation
      const tx = await contract.submitAIVerdict(jobId, percent, reason);
      await tx.wait();
      return tx.hash;
    } catch (e) {
      this.logger.error('submitAIVerdict failed:', e);
      throw e;
    }
  }

  // --- Admin Contract Settings ---

  async setDAOContract(daoAddress: string) {
    try {
      const wallet = this.getAdminWallet();
      const contract = new ethers.Contract(
        this.configService.get('TFA_DISPUTE_ADDRESS')!,
        DisputeArtifact.abi,
        wallet
      );

      const tx = await contract.setDAOContract(daoAddress);
      await tx.wait();
      return tx.hash;
    } catch (e) {
      this.logger.error('Failed to set DAO contract', e);
      throw e;
    }
  }

  async setFeePercentage(percent: number) {
    try {
      const wallet = this.getAdminWallet();
      const contract = new ethers.Contract(
        this.configService.get('TFA_DISPUTE_ADDRESS')!,
        DisputeArtifact.abi,
        wallet
      );

      const tx = await contract.setFeePercentage(percent);
      await tx.wait();
      return tx.hash;
    } catch (e) {
      this.logger.error('Failed to set fee percentage', e);
      throw e;
    }
  }

  // --- Admin Voter Management ---

  async registerVoter(voterAddress: string) {
    try {
      const wallet = this.getAdminWallet();
      const contract = new ethers.Contract(
        this.configService.get('TFA_DAO_VOTING_ADDRESS')!,
        DAOVotingArtifact.abi,
        wallet
      );

      const tx = await contract.registerVoter(voterAddress);
      await tx.wait();
      return tx.hash;
    } catch (e) {
      this.logger.error('Failed to register voter', e);
      throw e;
    }
  }

  async removeVoter(voterAddress: string) {
    try {
      const wallet = this.getAdminWallet();
      const contract = new ethers.Contract(
        this.configService.get('TFA_DAO_VOTING_ADDRESS')!,
        DAOVotingArtifact.abi,
        wallet
      );

      const tx = await contract.removeVoter(voterAddress);
      await tx.wait();
      return tx.hash;
    } catch (e) {
      this.logger.error('Failed to remove voter', e);
      throw e;
    }
  }

  async adjustVoterKarma(voterAddress: string, newKarma: number) {
    try {
      const wallet = this.getAdminWallet();
      const contract = new ethers.Contract(
        this.configService.get('TFA_DAO_VOTING_ADDRESS')!,
        DAOVotingArtifact.abi,
        wallet
      );

      const tx = await contract.adjustVoterKarma(voterAddress, newKarma);
      await tx.wait();
      return tx.hash;
    } catch (e) {
      this.logger.error('Failed to adjust voter karma', e);
      throw e;
    }
  }

  // --- User Actions (Coinbase SDK) ---

  async createJob(buyerWalletId: string, sellerWalletId: string | null, contractorAddress: string, amountUSDC: number) {
    try {
      this.logger.log(`Creating Job: BuyerWallet ${buyerWalletId} -> ${contractorAddress} ($${amountUSDC})`);
      const buyerWallet = await Wallet.fetch(buyerWalletId);

      const usdcAddress = this.configService.get('USDC_CONTRACT_ADDRESS')!;
      const disputeAddress = this.configService.get('TFA_DISPUTE_ADDRESS')!;

      const amountWei = ethers.parseUnits(amountUSDC.toString(), 6);
      const feeWei = (amountWei * 5n) / 100n; // 5% Fee
      const totalBuyerWei = (amountWei + feeWei).toString();

      // 1. Approve Buyer (Amount + Client Fee)
      const buyerApprove = await buyerWallet.invokeContract({
        contractAddress: usdcAddress,
        method: 'approve',
        args: { _spender: disputeAddress, _value: totalBuyerWei },
        abi: [{ constant: false, inputs: [{ name: '_spender', type: 'address' }, { name: '_value', type: 'uint256' }], name: 'approve', outputs: [{ name: '', type: 'bool' }], type: 'function' }] as any
      });
      await buyerApprove.wait();

      // 2. Approve Seller (Contractor Fee) - Address Smart Contract Bloacker
      if (sellerWalletId) {
        this.logger.log(`Handling Seller Fee Approval for Wallet: ${sellerWalletId}`);
        const sellerWallet = await Wallet.fetch(sellerWalletId);
        const sellerApprove = await sellerWallet.invokeContract({
          contractAddress: usdcAddress,
          method: 'approve',
          args: { _spender: disputeAddress, _value: feeWei.toString() },
          abi: [{ constant: false, inputs: [{ name: '_spender', type: 'address' }, { name: '_value', type: 'uint256' }], name: 'approve', outputs: [{ name: '', type: 'bool' }], type: 'function' }] as any
        });
        await sellerApprove.wait();
      }

      // 3. Create Job
      const invocation = await buyerWallet.invokeContract({
        contractAddress: disputeAddress,
        method: 'createJob',
        args: { _contractor: contractorAddress, _amount: amountWei.toString() },
        abi: DisputeArtifact.abi as any
      });
      await invocation.wait();

      return { hash: invocation.getTransactionHash(), receipt: null };
    } catch (e) {
      this.logger.error('createJob failed:', e);
      throw e;
    }
  }

  async raiseDispute(walletId: string, jobId: number) {
    try {
      const wallet = await Wallet.fetch(walletId);
      const tx = await wallet.invokeContract({
        contractAddress: this.configService.get('TFA_DISPUTE_ADDRESS')!,
        method: 'raiseDispute',
        args: { _jobId: jobId.toString() },
        abi: DisputeArtifact.abi as any
      });
      await tx.wait();
      return tx.getTransactionHash();
    } catch (e) {
      this.logger.error('Failed to raise dispute:', e);
      throw e;
    }
  }

  async castVote(walletId: string, jobId: number, percent: number) {
    try {
      const wallet = await Wallet.fetch(walletId);
      const tx = await wallet.invokeContract({
        contractAddress: this.configService.get('TFA_DAO_VOTING_ADDRESS')!,
        method: 'castVote',
        args: { _jobId: jobId.toString(), _contractorPercent: percent.toString() },
        abi: DAOVotingArtifact.abi as any
      });
      await tx.wait();
      return tx.getTransactionHash();
    } catch (e) {
      this.logger.error('Failed to cast vote:', e);
      throw e;
    }
  }

  async resolveDispute(walletId: string, jobId: number, contractorPercent: number) {
    // This function 'resolveFromDAO' is usually called by the DAO contract, not a user.
    // But if there's a manual override, or accept/reject flow.
    // V2 had acceptVerdict/rejectVerdict.
    return null;
  }

  async releaseFunds(walletId: string, jobId: number) {
    try {
      const wallet = await Wallet.fetch(walletId);
      // Assuming method name is releaseToContractor based on V2 code
      // If ABI differs, this will fail.
      const tx = await wallet.invokeContract({
        contractAddress: this.configService.get('TFA_DISPUTE_ADDRESS')!,
        method: 'releaseToContractor',
        args: { _jobId: jobId.toString() },
        abi: DisputeArtifact.abi as any
      });
      await tx.wait();
      return tx.getTransactionHash();
    } catch (e) {
      this.logger.error('Failed to release funds:', e);
      throw e;
    }
  }

  async acceptVerdict(walletId: string, jobId: number) {
    try {
      const wallet = await Wallet.fetch(walletId);
      const tx = await wallet.invokeContract({
        contractAddress: this.configService.get('TFA_DISPUTE_ADDRESS')!,
        method: 'acceptAIVerdict',
        args: { _jobId: jobId.toString() },
        abi: DisputeArtifact.abi as any
      });
      await tx.wait();
      return tx.getTransactionHash();
    } catch (e) {
      this.logger.error('Failed to accept verdict', e);
      throw e;
    }
  }

  async rejectVerdict(walletId: string, jobId: number) {
    try {
      const wallet = await Wallet.fetch(walletId);
      const tx = await wallet.invokeContract({
        contractAddress: this.configService.get('TFA_DISPUTE_ADDRESS')!,
        method: 'rejectAIVerdict',
        args: { _jobId: jobId.toString() },
        abi: DisputeArtifact.abi as any
      });
      await tx.wait();
      return tx.getTransactionHash();
    } catch (e) {
      this.logger.error('Failed to reject verdict', e);
      throw e;
    }
  }

  // --- Helper Getters ---

  getProvider() {
    return this.provider;
  }

  async verifyTransaction(txHash: string): Promise<any> {
    if (!this.provider) return { exists: false };
    const tx = await this.provider.getTransaction(txHash);
    if (!tx) return { exists: false };
    const receipt = await this.provider.getTransactionReceipt(txHash);
    return {
      exists: true,
      confirmed: receipt && receipt.status === 1,
      blockNumber: receipt?.blockNumber,
    };
  }

  async getBalances(address: string): Promise<{ native: string; usdc: string }> {
    if (!this.provider) return { native: '0', usdc: '0' };
    const balance = await this.provider.getBalance(address);
    const native = ethers.formatEther(balance);
    const usdcAddress = this.configService.get('USDC_CONTRACT_ADDRESS');
    let usdc = '0.00';
    if (usdcAddress) {
      try {
        const erc20 = new ethers.Contract(usdcAddress, ["function balanceOf(address) view returns (uint256)"], this.provider);
        const bal = await erc20.balanceOf(address);
        usdc = ethers.formatUnits(bal, 6);
      } catch (e) {
        this.logger.warn(`Failed to fetch USDC for ${address}`);
      }
    }
    return { native, usdc };
  }

  // --- DAO & Dispute Getters ---

  async getVoterInfo(address: string) {
    try {
      const info = await this.daoContract.getVoterInfo(address);
      return {
        isRegistered: info.isVoter,
        karma: Number(info.karma),
        canVote: info.canVote
      };
    } catch (e) {
      this.logger.error(`Failed to get voter info for ${address}`, e);
      return null;
    }
  }

  async getVotingSession(jobId: number) {
    try {
      const info = await this.daoContract.getSessionInfo(jobId);
      return {
        isActive: info.isActive,
        endTime: new Date(Number(info.endTime) * 1000),
        totalVotes: Number(info.totalVotes),
        isFinalized: info.isFinalized,
        consensusPercent: Number(info.consensusPercent)
      };
    } catch (e) {
      this.logger.error(`Failed to get session info for ${jobId}`, e);
      return null;
    }
  }

  async getJobDetails(jobId: number) {
    try {
      const job = await this.disputeContract.jobs(jobId);
      return {
        id: Number(job.id),
        client: job.client,
        contractor: job.contractor,
        amount: ethers.formatUnits(job.contractAmount, 6),
        fee: ethers.formatUnits(job.feeAmount, 6),
        status: statusMap[Number(job.state)] || 'Unknown'
      };
    } catch (e) {
      this.logger.error(`Failed to get job details for ${jobId}`, e);
      return null;
    }
  }

  // --- SQL API Implementation ---

  async runSql(query: string): Promise<any[]> {
    const apiKeyName = this.configService.get('COINBASE_API_KEY_NAME');
    const privateKey = this.configService.get('COINBASE_API_KEY_SECRET_KEY')?.replace(/\\n/g, '\n');

    if (!apiKeyName || !privateKey) {
      this.logger.warn('SQL API: Missing API keys for authentication');
      return [];
    }

    try {
      this.logger.log('Executing SQL Query against CDP Data API...');
      const { CoinbaseAuthenticator } = await import('@coinbase/coinbase-sdk');
      const auth = new CoinbaseAuthenticator(apiKeyName, privateKey, 'sdk');
      const url = 'https://api.cdp.coinbase.com/platform/v2/data/query/run';
      const jwt = await auth.buildJWT(url, 'POST');

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`,
        },
        body: JSON.stringify({ sql: query }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`CDP SQL API Error: ${response.status} - ${err}`);
      }

      const data = await response.json();
      return data.data || []; // API returns { data: [...] } usually, or result
    } catch (e) {
      this.logger.warn(`SQL API Query Failed: ${e.message}`);
      return [];
    }
  }

  async queryDepositEvents(toAddress: string): Promise<any[]> {
    const usdc = this.configService.get('USDC_CONTRACT_ADDRESS');
    if (!usdc) throw new Error('USDC_CONTRACT_ADDRESS not configured');

    // Updated Query for Base Sepolia (or Base) ERC20 Transfers
    const query = `
      SELECT 
        block_timestamp,
        transaction_hash,
        parameters['from'] as from_address,
        parameters['value'] as value
      FROM base.events 
      WHERE event_signature = 'Transfer(address,address,uint256)'
        AND address = '${usdc.toLowerCase()}'
        AND parameters['to'] = '${toAddress.toLowerCase()}'
      ORDER BY block_timestamp DESC 
      LIMIT 10
    `;
    return this.runSql(query);
  }
}
