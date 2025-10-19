import { v4 as uuid } from "uuid";
import { OpenAI } from "openai";
import { z } from "zod";

const OPENAI_API_KEY=""
// --- Zod Schemas ---
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

// --- Other Canonical Types ---

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

// --- FIX: Define a type for the input constraints ---
/** Input constraints from the user */
type InputConstraints = {
  slippage_bps_max?: number;
  freshness_s?: number;
};

// --- OpenAI Configuration ---
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const SYSTEM = `
You are a planning engine for DeFi agents. Output ONLY JSON matching this schema:
{
"plan_id": "uuid",
"steps": [
{
"type": "rfp" | "skill",
"capability": "swap.spl" | "rebalance" | "lp.manage" | "liquidate" | "report.publish",
"name": "rebalance" | "swap" | "add_liquidity" | "remove_liquidity" | "report_publish",
"inputs": {},
"constraints": {"slippage_bps_max": number, "freshness_s": number},
"budget_usd": number,
"slo": {"p95_ms": number}
}
]
}
Rules:

* For any on-chain action, prefer RFP first (hire best vendor), then use skill steps for execution that the platform can perform.
* Respect budgets and constraints if given by the user.
* Do NOT include narration; JSON only.
  `;

// --- Self-Contained Execution ---

/**
 * Main function to run the planning logic with a hardcoded example.
 */
async function main() {
  console.log("Generating plan for hardcoded example...");

  // 1. Hardcoded example input
  // --- FIX: Apply the InputConstraints type here ---
  const exampleInput: {
    goal: string;
    context: Record<string, any>;
    constraints: InputConstraints; // Use the type
    budget_usd: number;
  } = {
    goal: "Swap 1000 USDC (EPjF...) for as much SOL (So1111...) as possible",
    context: { "user_pubkey": "5K...Z" },
    constraints: { "slippage_bps_max": 20 }, // This is now valid
    budget_usd: 0.10
  };
  
  // Extract constraints and budget for the fallback plan
  // 'constraints' is now of type InputConstraints
  const { constraints, budget_usd } = exampleInput;
  const user = JSON.stringify(exampleInput);

  try {
    let text: string | undefined;

    // 2. Call OpenAI
    if (openai) {
      console.log(`Calling OpenAI model: ${MODEL}...`);
      try {
        const resp = await (openai.responses as any).create({
          model: MODEL,
          input: [
            { role: "system", content: SYSTEM },
            { role: "user", content: user }
          ]
        });
        text = resp.output_text;
      } catch (e) {
        // Fallback to chat completions
        console.log("Falling back to chat.completions...");
        const chat = await openai.chat.completions.create({
          model: MODEL,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: user }
          ],
          temperature: 0.2
        });
        text = chat.choices[0].message.content || "";
      }
    } else {
      console.log("OPENAI_API_KEY not set. Using fallback plan.");
    }

    // 3. Parse and provide fallback
    let plan;
    try { plan = text ? JSON.parse(text) : null; } catch { plan = null; }

    if (!plan) {
      console.log("OpenAI call failed or returned invalid JSON. Using fallback plan.");
      plan = {
        plan_id: uuid(),
        steps: [
          {
            type: "rfp",
            capability: "swap.spl",
            inputs: { inMint: "So1111...", outMint: "EPjF...", amount: "1000000" },
            // This line is now type-safe
            constraints: { slippage_bps_max: (constraints?.slippage_bps_max ?? 30), freshness_s: (constraints?.freshness_s ?? 5) },
            budget_usd: budget_usd ?? 0.25,
            slo: { p95_ms: 3000 }
          },
          { type: "skill", name: "rebalance", inputs: { legs: [] } }
        ]
      };
    }

    // 4. Validate and Print Output
    const parsed = PlanSchema.parse(plan);
    console.log("--- Plan Generated Successfully ---");
    console.log(JSON.stringify({ ok: true, plan: parsed }, null, 2));

  } catch (e: any) {
    // 5. Handle any errors and Print Error
    console.error("--- Error During Planning ---");
    console.error(JSON.stringify({ ok: false, error: e.message }, null, 2));
  }
}

// Run the main function
main();