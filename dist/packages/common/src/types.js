import { z } from "zod";
/** Guard profile enforced pre-sign (infra, not agent code) */
export const GuardConfigSchema = z.object({
    freshness_s: z.number().int().min(1).default(5),
    slippage_bps_max: z.number().int().min(1).default(50),
    price_dev_max: z.number().min(0).default(0.01),
    fee_sol_max: z.number().min(0).default(0.01),
    notional_usd_max: z.number().min(0).default(5000)
});
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
