import { swap } from "./swap.js";
import { GuardConfig } from "@agentrunner/common/types";

/** Multi-leg rebalance using swap() legs; in a real impl, consider Jito bundles. */
export async function rebalance(params: {
  legs: Array<{ inMint: string; outMint: string; amount: string; slippageBps: number; pythPriceIds: string[] }>;
  guard: GuardConfig;
}) {
  const results = [];
  for (const leg of params.legs) {
    const res = await swap({ ...leg, guard: params.guard });
    results.push(res);
    if (res.verdict.verdict !== "OK") break;
  }
  return results;
}
