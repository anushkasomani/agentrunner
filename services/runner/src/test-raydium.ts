import { raydiumSwap } from './raydium.ts'

async function testRaydiumSwap() {
  console.log('Testing Raydium swap integration...')
  
  try {
    const result = await raydiumSwap({
      inputMint: 'So11111111111111111111111111111111111111112', // SOL (Wrapped SOL)
      outputMint: 'USDCoctVLVnvTXBEuP9s8hntucdJokbo17RwHuNXemT', // USDC 
      amount: 1000000, // 0.001 SOL (in lamports)
      slippageBps: 100 // 1% slippage
    })
    
    if (result.error) {
      console.error('Swap failed:', result.error)
    } else {
      console.log('Swap successful!')
      console.log('Transaction ID:', result.txid)
      // console.log('Output amount:', result.outAmount)
    }
  } catch (error) {
    console.error('Test error:', error)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  testRaydiumSwap()
}
