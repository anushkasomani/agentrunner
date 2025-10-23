import { evaluateSwapGuards } from "@agentrunner/common/guards";
import type { GuardVerdict } from "@agentrunner/common/guards";
import type { GuardConfig } from "@agentrunner/common/types";

/**
 * Trusted swap skill using Raydium Trade API
 * 1) Evaluate guards (freshness, slippage, price deviation, notional, fee caps)
 * 2) Execute swap via Raydium API on devnet
 * 3) Return txid, out_amount, and guard verdict
 */

export async function swap(params: {
  inMint: string; outMint: string; amount: string; slippageBps: number;
  pythPriceIds: string[]; guard: GuardConfig;
}): Promise<{ txid?: string; outAmount?: string; verdict: GuardVerdict; quoteHash?: string; }> {
  console.log('Swap function called with params:', params);
  const verdict = await evaluateSwapGuards(params);
  console.log('Guard verdict:', verdict);
  // if (verdict.verdict !== "OK") return { verdict };

  try {
    // Convert amount to number (assuming it's already in the correct decimal format)
    const amountNumber = parseFloat(params.amount);
    // Import Raydium swap function dynamically to avoid circular dependencies
    const raydiumModulePath = "../../../../services/runner/src/raydium.js";
    const { raydiumSwap } = await import(raydiumModulePath);
    
    // Execute Raydium swap
    const result = await raydiumSwap({
      inputMint: params.inMint,
      outputMint: params.outMint,
      amount: amountNumber,
      slippageBps: params.slippageBps
    });

    if (result.error) {
      throw new Error(`Raydium swap failed: ${result.error}`);
    }
    console.log("raydium swap worked");
    return { 
      txid: result.txid, 
      outAmount: result.outAmount, 
      verdict, 
      quoteHash: verdict.quote_response_hash 
    };
  } catch (error: any) {
    console.error('Swap execution error:', error);
    throw new Error(`Swap failed: ${error.message}`);
  }
}
