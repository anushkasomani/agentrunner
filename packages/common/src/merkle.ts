import keccak256 from "keccak256";
import { MerkleTree } from "merkletreejs";

export function buildDailyMerkle(receipts: string[]) {
  const leaves = receipts.map(r => keccak256(r));
  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  const root = tree.getHexRoot();
  return { root, tree };
}
