import {
    createSolanaRpc,
    generateKeyPairSigner,
    createTransactionMessage,
    setTransactionMessageFeePayerSigner,
    sendAndConfirmTransactionFactory,
    pipe
  } from "@solana/web3.js";
  
  const RPC_URL = process.env.SOLANA_RPC_URL!;
  
  export function rpc() {
    return createSolanaRpc(RPC_URL);
  }
  
  export async function sendV0Tx(instructions: any[], feePayer?: any) {
    const rpcConn = rpc();
    const feePayerSigner = feePayer ?? await generateKeyPairSigner();
    const { value: { blockhash } } = await rpcConn.getLatestBlockhash().send();
  
    const message = await pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayerSigner(feePayerSigner, m),
    );
    const tx = await message.compileToV0Transaction({ blockhash });
    const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc: rpcConn });
    const sig = await sendAndConfirm(tx);
    return sig;
  }
  