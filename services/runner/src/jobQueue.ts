// Job queue implementation for execution management

import Queue from 'bull';
import { ExecutionPlan, ExecutionReceipt, ExecutionStatus } from '@agentrunner/common';
import { SwapSkill } from '@agentrunner/skills';
import { RebalanceSkill } from '@agentrunner/skills';
import { ReceiptManager } from '@agentrunner/common';
import { MerkleAnchoring } from '@agentrunner/common';

export class JobQueue {
  private executionQueue: Queue.Queue;
  private receiptManager: ReceiptManager;
  private merkleAnchoring: MerkleAnchoring;
  private skills: Map<string, any> = new Map();

  constructor() {
    this.executionQueue = new Queue('execution', process.env.REDIS_URL || 'redis://localhost:6379');
    this.receiptManager = new ReceiptManager();
    this.merkleAnchoring = new MerkleAnchoring();
    
    // Register available skills
    this.skills.set('swap', new SwapSkill());
    this.skills.set('rebalance', new RebalanceSkill());
    
    this.setupProcessors();
  }

  private setupProcessors(): void {
    // Process execution plans
    this.executionQueue.process('execute-plan', async (job) => {
      const plan: ExecutionPlan = job.data;
      console.log(`Processing execution plan: ${plan.id}`);
      
      try {
        // Execute steps in order
        for (const step of plan.steps) {
          await this.executeStep(plan.id, step);
        }
        
        console.log(`Execution plan ${plan.id} completed successfully`);
      } catch (error) {
        console.error(`Execution plan ${plan.id} failed:`, error);
        throw error;
      }
    });

    // Process individual steps
    this.executionQueue.process('execute-step', async (job) => {
      const { planId, step } = job.data;
      await this.executeStep(planId, step);
    });
  }

  private async executeStep(planId: string, step: any): Promise<void> {
    const receipt = this.receiptManager.createReceipt(planId, step.id);
    
    try {
      // Update status to running
      this.receiptManager.updateReceiptStatus(receipt.id, ExecutionStatus.RUNNING);
      
      // Get skill implementation
      const skill = this.skills.get(step.skillId);
      if (!skill) {
        throw new Error(`Skill ${step.skillId} not found`);
      }
      
      // Execute skill
      const result = await skill.execute(step.inputs);
      
      // Update receipt with success
      this.receiptManager.updateReceiptStatus(
        receipt.id, 
        ExecutionStatus.COMPLETED, 
        result
      );
      
      // Add receipt to merkle tree
      const receiptData = JSON.stringify({
        id: receipt.id,
        planId: receipt.planId,
        stepId: receipt.stepId,
        status: receipt.status,
        result: receipt.result,
        timestamp: receipt.timestamp
      });
      
      this.merkleAnchoring.addReceiptToTree(planId, receiptData);
      
      console.log(`Step ${step.id} completed successfully`);
      
    } catch (error) {
      // Update receipt with failure
      this.receiptManager.updateReceiptStatus(
        receipt.id, 
        ExecutionStatus.FAILED, 
        undefined, 
        error instanceof Error ? error.message : 'Unknown error'
      );
      
      console.error(`Step ${step.id} failed:`, error);
      throw error;
    }
  }

  async addExecutionPlan(plan: ExecutionPlan): Promise<string> {
    const job = await this.executionQueue.add('execute-plan', plan, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });
    
    return job.id.toString();
  }

  async getExecutionStatus(planId: string): Promise<{
    planId: string;
    status: string;
    receipts: ExecutionReceipt[];
  }> {
    const receipts = this.receiptManager.getReceiptsByPlan(planId);
    
    let overallStatus = 'pending';
    if (receipts.length === 0) {
      overallStatus = 'pending';
    } else if (receipts.every(r => r.status === ExecutionStatus.COMPLETED)) {
      overallStatus = 'completed';
    } else if (receipts.some(r => r.status === ExecutionStatus.FAILED)) {
      overallStatus = 'failed';
    } else if (receipts.some(r => r.status === ExecutionStatus.RUNNING)) {
      overallStatus = 'running';
    }
    
    return {
      planId,
      status: overallStatus,
      receipts
    };
  }

  async getExecutionReceipts(planId: string): Promise<ExecutionReceipt[]> {
    return this.receiptManager.getReceiptsByPlan(planId);
  }

  async cancelExecution(planId: string): Promise<void> {
    // Find and cancel jobs for this plan
    const jobs = await this.executionQueue.getJobs(['waiting', 'active']);
    
    for (const job of jobs) {
      if (job.data.id === planId) {
        await job.remove();
      }
    }
    
    // Update receipts to cancelled
    const receipts = this.receiptManager.getReceiptsByPlan(planId);
    for (const receipt of receipts) {
      if (receipt.status === ExecutionStatus.PENDING || receipt.status === ExecutionStatus.RUNNING) {
        this.receiptManager.updateReceiptStatus(receipt.id, ExecutionStatus.CANCELLED);
      }
    }
  }

  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    const waiting = await this.executionQueue.getWaiting();
    const active = await this.executionQueue.getActive();
    const completed = await this.executionQueue.getCompleted();
    const failed = await this.executionQueue.getFailed();
    
    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length
    };
  }
}

