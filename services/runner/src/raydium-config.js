import { Raydium, TxVersion, parseTokenAccountResp, DEV_API_URLS } from '@raydium-io/raydium-sdk-v2';
import { Connection, Keypair, clusterApiUrl } from '@solana/web3.js';
import { NATIVE_MINT, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
export const FEE_PAYER_SECRET_KEY = [94, 21, 75, 106, 120, 153, 168, 235, 114, 39, 104, 0, 255, 148, 42, 122, 107, 26, 9, 2, 228, 10, 81, 11, 232, 159, 190, 211, 236, 16, 59, 232, 243, 51, 153, 0, 152, 19, 129, 196, 31, 240, 193, 61, 248, 14, 75, 207, 158, 187, 213, 67, 243, 131, 40, 248, 248, 198, 180, 155, 152, 217, 219, 178];
// Environment variables
const WALLET_SECRET_KEY = FEE_PAYER_SECRET_KEY || process.env.RUNNER_SECRET_KEY;
const RPC_URL = process.env.SOLANA_RPC_URL || clusterApiUrl('devnet');
if (!WALLET_SECRET_KEY) {
    throw new Error('FEE_PAYER_SECRET_KEY or RUNNER_SECRET_KEY environment variable is required');
}
export const owner = Keypair.fromSecretKey(new Uint8Array(FEE_PAYER_SECRET_KEY));
export const connection = new Connection(RPC_URL);
export const txVersion = TxVersion.V0; // Use V0 for versioned transactions
const cluster = 'devnet';
let raydium;
export const initSdk = async (params) => {
    if (raydium)
        return raydium;
    if (connection.rpcEndpoint === clusterApiUrl('mainnet-beta'))
        console.warn('using free rpc node might cause unexpected error, strongly suggest uses paid rpc node');
    console.log(`connect to rpc ${connection.rpcEndpoint} in ${cluster}`);
    raydium = await Raydium.load({
        owner,
        connection,
        cluster,
        disableFeatureCheck: true,
        disableLoadToken: !params?.loadToken,
        blockhashCommitment: 'finalized',
        ...(cluster === 'devnet'
            ? {
                urlConfigs: {
                    ...DEV_API_URLS,
                    BASE_HOST: 'https://api-v3-devnet.raydium.io',
                    OWNER_BASE_HOST: 'https://owner-v1-devnet.raydium.io',
                    SWAP_HOST: 'https://transaction-v1-devnet.raydium.io',
                    CPMM_LOCK: 'https://dynamic-ipfs-devnet.raydium.io/lock/cpmm/position',
                },
            }
            : {}),
    });
    return raydium;
};
export const fetchTokenAccountData = async () => {
    const solAccountResp = await connection.getAccountInfo(owner.publicKey);
    const tokenAccountResp = await connection.getTokenAccountsByOwner(owner.publicKey, { programId: TOKEN_PROGRAM_ID });
    const token2022Req = await connection.getTokenAccountsByOwner(owner.publicKey, { programId: TOKEN_2022_PROGRAM_ID });
    const tokenAccountData = parseTokenAccountResp({
        owner: owner.publicKey,
        solAccountResp,
        tokenAccountResp: {
            context: tokenAccountResp.context,
            value: [...tokenAccountResp.value, ...token2022Req.value],
        },
    });
    return tokenAccountData;
};
// Export commonly used constants
export { NATIVE_MINT };
export const API_URLS = DEV_API_URLS;
