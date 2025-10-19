import fetch from "node-fetch";
const BASE = process.env.DATA_LAYER_URL;

function mustBase() {
  if (!BASE) throw new Error("DATA_LAYER_URL not set");
  return BASE!;
}

// index each signed receipt for analytics/ratings/replay
export async function dlPostReceipt(receipt: any) {
  const r = await fetch(`${mustBase()}/receipts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(receipt)
  });
  if (!r.ok) throw new Error(`dlPostReceipt failed: ${r.status} ${await r.text()}`);
  return r.json();
}

// pull ecosystem benchmarks (median price, p95 latency, etc.)
export async function dlBenchmarks(capability: string) {
  const r = await fetch(`${mustBase()}/benchmarks?capability=${encodeURIComponent(capability)}`);
  if (!r.ok) throw new Error(`dlBenchmarks failed: ${r.status} ${await r.text()}`);
  return r.json();
}

// verify a receipt by replaying PIT state on your DL
export async function dlReplayReceipt(receiptId: string) {
  const r = await fetch(`${mustBase()}/replay/receipt/${encodeURIComponent(receiptId)}`);
  if (!r.ok) throw new Error(`dlReplayReceipt failed: ${r.status} ${await r.text()}`);
  return r.json();
}

// optional: fetch PIT snapshot for a slot
export async function dlPitSnapshot(slot: number) {
  const r = await fetch(`${mustBase()}/pit?slot=${slot}`);
  if (!r.ok) throw new Error(`dlPitSnapshot failed: ${r.status} ${await r.text()}`);
  return r.json();
}
