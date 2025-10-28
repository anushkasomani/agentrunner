import { makePayment } from "./run.ts";

async function runSip(symbol: string, timeframe: string) {
    try {
        console.log('Making request to OHLCV API...');
        
        const response = await fetch(`http://localhost:8000/ohlcv?symbol=${symbol}&timeframe=${timeframe}`);
        console.log(response.status)
        if(response.status === 402) {
            console.log('Payment required');
            const body = await response.text();
            const invoiceData = JSON.parse(body);
            const invoiceId = invoiceData.id;
            console.log('Invoice ID:', invoiceId);
            
            const payment = await makePayment(body);
            console.log("Payment successful", payment);
            
            // Make second request with payment headers
            const response2 = await fetch(`http://localhost:8000/ohlcv?symbol=${symbol}&timeframe=${timeframe}`, {
                headers: {
                    'X-402-Invoice': invoiceId,
                    'X-402-Proof-Tx': payment.txid,
                    'X-402-Proof-Mint': payment.mint,
                    'X-402-Chain': payment.chain,
                    'X-402-Amount': payment.amount.toString()
                }
            });
            console.log(response2.status);
            if(response2.status === 200) {
                console.log('Data fetched successfully');
                const data = await response2.json();
                console.log(data);
            } else {
                console.log('Failed to fetch data');
            }
        } else {
            console.log('Payment successful');
        }
    } catch (error) {
        console.error('Failed to make GET request:', error);
    }
}

runSip("btc", "1d");
