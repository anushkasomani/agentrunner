export async function quoteJupiter(inputMint: string, outputMint:string, amount:number, slippageBps?:number,swapMode?: string){
    let queryParams = [];
    queryParams.push(`inputMint=${inputMint}`);
    queryParams.push(`outputMint=${outputMint}`);
    queryParams.push(`amount=${amount}`);
    slippageBps? queryParams.push(`slippageBps=${slippageBps}`): queryParams.push(`slippageBps=50`)
    swapMode? queryParams.push(`swapMode=${swapMode}`): queryParams.push(`swapMode=ExactIn`)
    queryParams.push("restrictIntermediateTokens=true")
    queryParams.push("maxAccounts=64")
    queryParams.push("instructionVersion=V1")
    
    const queryString = queryParams.length ? `?${queryParams.join('&')}` : '';
    const url = `https://lite-api.jup.ag/swap/v1/quote${queryString}`;
    const options = {method: 'GET', body: undefined};

try {
  const response = await fetch(url, options);
  const data = await response.json();
  console.log(data);
} catch (error) {
  console.error(error);
}
}

//example usage
quoteJupiter("So11111111111111111111111111111111111111112","EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", 1000000)

export async function swapJupiter(userPublicKey: string , quoteResponse:object){
const url = 'https://lite-api.jup.ag/swap/v1/swap';
const options = {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: '{"userPublicKey":"jdocuPgEAjMfihABsPgKEvYtsmMzjUHeq9LX4Hvs7f3","quoteResponse":{"inputMint":"So11111111111111111111111111111111111111112","inAmount":"1000000","outputMint":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v","outAmount":"125630","otherAmountThreshold":"125002","swapMode":"ExactIn","slippageBps":50,"platformFee":null,"priceImpactPct":"0","routePlan":[{"swapInfo":{"ammKey":"AvBSC1KmFNceHpD6jyyXBV6gMXFxZ8BJJ3HVUN8kCurJ","label":"Obric V2","inputMint":"So11111111111111111111111111111111111111112","outputMint":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v","inAmount":"1000000","outAmount":"125630","feeAmount":"5","feeMint":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"},"percent":100}]},"prioritizationFeeLamports":{"priorityLevelWithMaxLamports":{"maxLamports":10000000,"priorityLevel":"veryHigh"}},"dynamicComputeUnitLimit":true}'
};

try {
  const response = await fetch(url, options);
  const data = await response.json();
  console.log(data);
} catch (error) {
  console.error(error);
}
}