// X402 Merchant service for payment challenges

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { PaymentChallenge, PaymentVerification } from '@agentrunner/common';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;

// Initialize Solana connection
const connection = new Connection(
  process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  'confirmed'
);

const USDC_MINT = new PublicKey(process.env.USDC_MINT || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'x402-merchant'
  });
});

// Create payment challenge
app.post('/challenge', async (req, res) => {
  try {
    const { amount, recipient, expiresIn } = req.body;
    
    if (!amount || !recipient) {
      return res.status(400).json({ error: 'Amount and recipient are required' });
    }

    const challenge = await createPaymentChallenge(amount, recipient, expiresIn);
    
    res.json(challenge);
  } catch (error) {
    console.error('Error creating payment challenge:', error);
    res.status(500).json({ error: 'Failed to create payment challenge' });
  }
});

async function createPaymentChallenge(
  amount: number,
  recipient: string,
  expiresIn: number = 3600
): Promise<PaymentChallenge> {
  const challengeId = `challenge_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  const challenge = `pay_${amount}_usdc_to_${recipient}_${challengeId}`;
  
  const paymentChallenge: PaymentChallenge = {
    id: challengeId,
    amount,
    currency: 'USDC',
    recipient,
    challenge,
    expiresAt: new Date(Date.now() + expiresIn * 1000)
  };

  // Store challenge (in production, use database)
  // For now, just return the challenge
  
  return paymentChallenge;
}

// Verify payment
app.post('/verify', async (req, res) => {
  try {
    const { challengeId, transactionId } = req.body;
    
    if (!challengeId || !transactionId) {
      return res.status(400).json({ error: 'Challenge ID and transaction ID are required' });
    }

    const verification = await verifyPayment(challengeId, transactionId);
    
    res.json(verification);
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

async function verifyPayment(
  challengeId: string,
  transactionId: string
): Promise<PaymentVerification> {
  try {
    // Get transaction details
    const transaction = await connection.getTransaction(transactionId, {
      commitment: 'confirmed'
    });

    if (!transaction) {
      return {
        challengeId,
        transactionId,
        verified: false,
        timestamp: new Date()
      };
    }

    // Verify transaction contains USDC transfer
    // This is a simplified verification - in production, you'd:
    // 1. Parse the transaction instructions
    // 2. Check for USDC transfer to the correct recipient
    // 3. Verify the amount matches the challenge
    
    const verified = true; // Mock verification
    
    return {
      challengeId,
      transactionId,
      verified,
      timestamp: new Date()
    };
  } catch (error) {
    console.error('Error verifying payment:', error);
    return {
      challengeId,
      transactionId,
      verified: false,
      timestamp: new Date()
    };
  }
}

// Get challenge status
app.get('/challenge/:challengeId', async (req, res) => {
  try {
    const { challengeId } = req.params;
    
    // In production, fetch from database
    const challenge = {
      id: challengeId,
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 3600 * 1000)
    };
    
    res.json(challenge);
  } catch (error) {
    console.error('Error getting challenge:', error);
    res.status(500).json({ error: 'Failed to get challenge' });
  }
});

// Process refund
app.post('/refund', async (req, res) => {
  try {
    const { challengeId, reason } = req.body;
    
    if (!challengeId) {
      return res.status(400).json({ error: 'Challenge ID is required' });
    }

    // Process refund logic
    const refund = {
      challengeId,
      refundId: `refund_${Date.now()}`,
      amount: 0, // Would be fetched from challenge
      reason: reason || 'Requested refund',
      status: 'processed',
      timestamp: new Date()
    };
    
    res.json(refund);
  } catch (error) {
    console.error('Error processing refund:', error);
    res.status(500).json({ error: 'Failed to process refund' });
  }
});

// Error handling
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`X402 Merchant service listening on port ${PORT}`);
});

export default app;


