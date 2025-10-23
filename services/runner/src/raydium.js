import { VersionedTransaction, PublicKey } from '@solana/web3.js';
import { NATIVE_MINT } from '@solana/spl-token';
import axios from 'axios';
import { connection, owner, initSdk, API_URLS } from './raydium-config';
//to do ; fix the amount amount. on hold for now
export async function raydiumSwap(params) {
    try {
        // Initialize Raydium SDK
        const raydium = await initSdk({ loadToken: true });
        const { inputMint, outputMint, amount, slippageBps } = params;
        const txVersion = 'V0'; // Use versioned transactions
        const isInputSol = inputMint === NATIVE_MINT.toBase58();
        const isOutputSol = outputMint === NATIVE_MINT.toBase58();
        console.log(`Raydium swap: ${inputMint} -> ${outputMint}, amount: ${amount}, slippage: ${slippageBps}bps`);
        // 1. Get priority fee
        const priorityUrl = `${API_URLS.BASE_HOST}${API_URLS.PRIORITY_FEE}`;
        console.log('Priority fee URL:', priorityUrl);
        console.log('API_URLS.BASE_HOST:', API_URLS.BASE_HOST);
        console.log('API_URLS.PRIORITY_FEE:', API_URLS.PRIORITY_FEE);
        let priorityData;
        try {
            const response = await axios.get(priorityUrl);
            priorityData = response.data;
            console.log('Priority fee response:', priorityData);
        }
        catch (error) {
            console.error('Priority fee request failed:', error instanceof Error ? error.message : String(error));
            throw error;
        }
        if (!priorityData.success) {
            throw new Error('Failed to get priority fee data');
        }
        // 2. Get quote
        const quoteUrl = `${API_URLS.SWAP_HOST}/compute/swap-base-in?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}&txVersion=${txVersion}`;
        const { data: swapResponse } = await axios.get(quoteUrl);
        if (!swapResponse.success) {
            throw new Error(`Raydium quote failed: ${JSON.stringify(swapResponse)}`);
        }
        console.log('Quote successful:', swapResponse);
        // 3. Get token accounts if needed
        let inputTokenAcc;
        let outputTokenAcc;
        if (!isInputSol) {
            const tokenAccounts = await connection.getTokenAccountsByOwner(owner.publicKey, {
                mint: new PublicKey(inputMint)
            });
            if (tokenAccounts.value.length === 0) {
                throw new Error(`No token account found for input mint ${inputMint}`);
            }
            inputTokenAcc = tokenAccounts.value[0].pubkey.toBase58();
        }
        if (!isOutputSol) {
            const tokenAccounts = await connection.getTokenAccountsByOwner(owner.publicKey, {
                mint: new PublicKey(outputMint)
            });
            if (tokenAccounts.value.length > 0) {
                outputTokenAcc = tokenAccounts.value[0].pubkey.toBase58();
            }
        }
        // 4. Serialize transaction
        const { data: swapTransactions } = await axios.post(`${API_URLS.SWAP_HOST}/transaction/swap-base-in`, {
            computeUnitPriceMicroLamports: String(priorityData.data.default.h),
            swapResponse,
            txVersion,
            wallet: owner.publicKey.toBase58(),
            wrapSol: isInputSol,
            unwrapSol: isOutputSol,
            inputAccount: isInputSol ? undefined : inputTokenAcc,
            outputAccount: isOutputSol ? undefined : outputTokenAcc,
        });
        if (!swapTransactions.success) {
            throw new Error(`Raydium transaction serialization failed: ${JSON.stringify(swapTransactions)}`);
        }
        console.log(`Total ${swapTransactions.data.length} transactions to execute`);
        // 5. Deserialize and execute transactions
        const allTxBuf = swapTransactions.data.map((tx) => Buffer.from(tx.transaction, 'base64'));
        const allTransactions = allTxBuf.map((txBuf) => VersionedTransaction.deserialize(txBuf));
        let lastTxId;
        // Execute transactions sequentially
        for (let i = 0; i < allTransactions.length; i++) {
            const transaction = allTransactions[i];
            transaction.sign([owner]);
            console.log(`Executing transaction ${i + 1}/${allTransactions.length}`);
            const txId = await connection.sendTransaction(transaction, { skipPreflight: true });
            lastTxId = txId;
            const { lastValidBlockHeight, blockhash } = await connection.getLatestBlockhash({
                commitment: 'finalized',
            });
            console.log(`Transaction ${i + 1} sent, txId: ${txId}`);
            await connection.confirmTransaction({
                blockhash,
                lastValidBlockHeight,
                signature: txId,
            }, 'confirmed');
            console.log(`Transaction ${i + 1} confirmed`);
        }
        // Extract output amount from the quote response
        const outAmount = '0'; // Raydium doesn't return outAmount in the same format, we'll need to calculate it differently
        return {
            txid: lastTxId,
            outAmount: outAmount.toString(),
        };
    }
    catch (error) {
        console.error('Raydium swap error:', error);
        return {
            error: error.message || 'Unknown error occurred during swap'
        };
    }
}
/**
 * Helper function to get token account for a given mint
 */
export async function getTokenAccount(mint) {
    try {
        const tokenAccounts = await connection.getTokenAccountsByOwner(owner.publicKey, {
            mint: new PublicKey(mint)
        });
        return tokenAccounts.value.length > 0 ? tokenAccounts.value[0].pubkey.toBase58() : null;
    }
    catch (error) {
        console.error('Error getting token account:', error);
        return null;
    }
}
/**
 * Helper function to check if wallet has sufficient balance
 */
export async function checkBalance(mint, requiredAmount) {
    try {
        if (mint === NATIVE_MINT.toBase58()) {
            const balance = await connection.getBalance(owner.publicKey);
            return balance >= requiredAmount;
        }
        else {
            const tokenAccount = await getTokenAccount(mint);
            if (!tokenAccount)
                return false;
            const accountInfo = await connection.getTokenAccountBalance(new PublicKey(tokenAccount));
            return accountInfo.value.uiAmount ? accountInfo.value.uiAmount >= requiredAmount : false;
        }
    }
    catch (error) {
        console.error('Error checking balance:', error);
        return false;
    }
}
