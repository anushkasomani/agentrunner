import { z } from "zod";

/** Guard profile enforced pre-sign (infra, not agent code) */
export const GuardConfigSchema = z.object({
  freshness_s: z.number().int().min(1).default(5),
  slippage_bps_max: z.number().int().min(1).default(50),
  price_dev_max: z.number().min(0).default(0.01),
  fee_sol_max: z.number().min(0).default(0.01),
  notional_usd_max: z.number().min(0).default(5000)
});
export type GuardConfig = z.infer<typeof GuardConfigSchema>;

/** Plan emitted by planner (OpenAI) */
export const PlanSchema = z.object({
  plan_id: z.string(),
  steps: z.array(z.object({
    type: z.enum(["rfp", "skill"]),
    capability: z.string().optional(),
    name: z.string().optional(),
    inputs: z.record(z.any()).optional(),
    constraints: z.record(z.any()).optional(),
    budget_usd: z.number().optional(),
    slo: z.record(z.any()).optional()
  }))
});
export type Plan = z.infer<typeof PlanSchema>;

/** Canonical receipt (signed) */
export type Receipt = {
  runner_pubkey: string;
  agent: string;
  task_id: string;
  when_unix: number;
  inputs: Record<string, any>;
  outputs: Record<string, any>;
  protocols: string[];
  fees: { lamports: number; jito_tip_lamports?: number; usdc?: string };
  cost_usd: string;
  guards: {
    freshness_s: number; slippage_bps: number;
    notional_usd: number; price_deviation: number;
    tx_fee_sol: number; verdict: "OK" | "FAIL"
  };
  refs: { pyth_ids?: string[]; quote_response_hash?: string; config_hash?: string };
  sign?: { algo: "ed25519"; sig: string };
};

/** Simple offer from marketplace */
export type Offer = {
  agent_id: string;
  price_usd: number;
  eta_ms: number;
  confidence: number;
  terms?: Record<string, any>;
  proofs?: Record<string, any>;
};

/** Execution status enum */
export enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

/** Execution plan for job queue */
export type ExecutionPlan = {
  id: string;
  steps: ExecutionStep[];
};

/** Individual execution step */
export type ExecutionStep = {
  id: string;
  skillId: string;
  inputs: Record<string, any>;
};

/** Execution receipt for tracking */
export type ExecutionReceipt = {
  id: string;
  planId: string;
  stepId: string;
  status: ExecutionStatus;
  result?: any;
  error?: string;
  timestamp: number;
};
