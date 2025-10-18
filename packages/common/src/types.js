"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanSchema = exports.GuardConfigSchema = void 0;
var zod_1 = require("zod");
/** Guard profile enforced pre-sign (infra, not agent code) */
exports.GuardConfigSchema = zod_1.z.object({
    freshness_s: zod_1.z.number().int().min(1).default(5),
    slippage_bps_max: zod_1.z.number().int().min(1).default(50),
    price_dev_max: zod_1.z.number().min(0).default(0.01),
    fee_sol_max: zod_1.z.number().min(0).default(0.01),
    notional_usd_max: zod_1.z.number().min(0).default(5000)
});
/** Plan emitted by planner (OpenAI) */
exports.PlanSchema = zod_1.z.object({
    plan_id: zod_1.z.string(),
    steps: zod_1.z.array(zod_1.z.object({
        type: zod_1.z.enum(["rfp", "skill"]),
        capability: zod_1.z.string().optional(),
        name: zod_1.z.string().optional(),
        inputs: zod_1.z.record(zod_1.z.any()).optional(),
        constraints: zod_1.z.record(zod_1.z.any()).optional(),
        budget_usd: zod_1.z.number().optional(),
        slo: zod_1.z.record(zod_1.z.any()).optional()
    }))
});
