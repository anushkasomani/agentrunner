export interface PlannerRequest {
    goal: string;
    budget_usd: number;
    constraints: {
      slippage_bps_max: number;
      freshness_s: number;
    };
    context?: string;
  }
  
  export interface PlanStep {
    type: "rfp" | "skill";
    capability?: string;
    name?: string;
    inputs?: Record<string, any>;
    constraints?: Record<string, any>;
    budget_usd?: number;
    slo?: {
      p95_ms?: number;
    };
    [key: string]: unknown;
  }
  
  export interface Plan {
    plan_id: string;
    steps: PlanStep[];
    [key: string]: unknown;
  }
  
  export async function callPlanner(
    goal: string,
    budget: number
  ): Promise<Plan> {
    // Use our Next.js API route as a proxy
    const apiUrl = "/api";
  
    const request: PlannerRequest = {
      goal,
      budget_usd: budget,
      constraints: {
        slippage_bps_max: 30,
        freshness_s: 5,
      },
    };
  
    try {
      console.log(`[Planner] Calling ${apiUrl}/plan with goal: "${goal}"`);
  
      const response = await fetch(`${apiUrl}/plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });
  
      console.log(`[Planner] Response status: ${response.status}`);
  
      if (!response.ok) {
        let errorMessage = `API returned ${response.status}`;
        try {
          const errorData = await response.json();
          console.error(`[Planner] Error response:`, errorData);
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // If we can't parse error JSON, use status message
        }
        console.error(`[Planner] API error:`, errorMessage);
        throw new Error(errorMessage);
      }
  
      const data = await response.json();
      console.log(`[Planner] Response data:`, data);
  
      // Handle response from planner (expects { ok: true, plan: {...} })
      if (data.plan) {
        console.log(`[Planner] Plan received with ${data.plan.steps?.length || 0} steps`);
        return data.plan;
      }
  
      // Fallback if no plan in response
      console.warn(`[Planner] No plan in response, using fallback`);
      return {
        plan_id: "fallback",
        steps: [],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Planner] Failed:`, errorMessage);
      throw new Error(`planner_failed: ${errorMessage}`);
    }
  }
  
  export function summarizePlan(plan: Plan): {
    summary: string;
    bullets: string[];
  } {
    const bullets: string[] = [];
  
    if (!plan.steps || plan.steps.length === 0) {
      return {
        summary: "No steps planned.",
        bullets: ["No action items"],
      };
    }
  
    for (const step of plan.steps) {
      const stepType = step.type || "unknown";
      const capability = step.capability || step.name || "unknown";
      const budget = step.budget_usd
        ? `$${step.budget_usd.toFixed(2)}`
        : "budget TBD";
      const slo = step.slo?.p95_ms ? `, p95≤${step.slo.p95_ms}ms` : "";
  
      let bullet = "";
  
      if (stepType === "rfp") {
        bullet = `RFP • ${capability} (${budget}${slo}) [slippage_bps_max=30, freshness_s=5]`;
      } else if (stepType === "skill") {
        const inputs = step.inputs || {};
        const legs = inputs.legs ? ` (${inputs.legs} leg${inputs.legs > 1 ? "s" : ""})` : "";
        bullet = `SKILL • ${capability || step.name}${legs}`;
      } else {
        bullet = `${stepType.toUpperCase()} • ${capability}`;
      }
  
      if (bullet) {
        bullets.push(bullet);
      }
    }
  
    const summary =
      bullets.length > 0
        ? bullets.join("\n")
        : "No action items";
  
    return { summary, bullets };
  }