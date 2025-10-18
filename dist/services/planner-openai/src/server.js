import express from "express";
import { v4 as uuid } from "uuid";
import { OpenAI } from "openai";
import { PlanSchema } from '../../../packages/common/src/types';
const app = express();
app.use(express.json());
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
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
app.post("/plan", async (req, res) => {
    try {
        const { goal, context, constraints, budget_usd } = req.body || {};
        const user = JSON.stringify({ goal, context, constraints, budget_usd });
        let text;
        if (openai) {
            try {
                const resp = await openai.responses.create({
                    model: MODEL,
                    input: [
                        { role: "system", content: SYSTEM },
                        { role: "user", content: user }
                    ]
                });
                text = resp.output_text;
            }
            catch (e) {
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
        }
        let plan;
        try {
            plan = text ? JSON.parse(text) : null;
        }
        catch {
            plan = null;
        }
        if (!plan) {
            plan = {
                plan_id: uuid(),
                steps: [
                    {
                        type: "rfp",
                        capability: "swap.spl",
                        inputs: { inMint: "So1111...", outMint: "EPjF...", amount: "1000000" },
                        constraints: { slippage_bps_max: (constraints?.slippage_bps_max ?? 30), freshness_s: (constraints?.freshness_s ?? 5) },
                        budget_usd: budget_usd ?? 0.25,
                        slo: { p95_ms: 3000 }
                    },
                    { type: "skill", name: "rebalance", inputs: { legs: [] } }
                ]
            };
        }
        const parsed = PlanSchema.parse(plan);
        res.json({ ok: true, plan: parsed });
    }
    catch (e) {
        res.status(400).json({ ok: false, error: e.message });
    }
});
app.listen(7002, () => console.log("Planner(OpenAI) listening on :7002"));
