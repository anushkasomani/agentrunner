

import stringify from "fast-json-stable-stringify";
import * as ed from "@noble/ed25519";

export async function signReceipt(receipt: any, privateKeyBytes: Uint8Array) {
  const copy = { ...receipt };
  delete copy.sign;
  const payload = new TextEncoder().encode(stringify(copy));
  const sig = await ed.signAsync(payload, privateKeyBytes);
  return { ...receipt, sign: { algo: "ed25519", sig: Buffer.from(sig).toString("base64") } };
}

export async function verifyReceipt(receipt: any, publicKeyBytes: Uint8Array): Promise<boolean> {
  if (!receipt?.sign?.sig) return false;
  const copy = { ...receipt };
  delete copy.sign;
  const payload = new TextEncoder().encode(stringify(copy));
  const sigBytes = Buffer.from(receipt.sign.sig, "base64");
  return ed.verify(sigBytes, payload, publicKeyBytes);
}