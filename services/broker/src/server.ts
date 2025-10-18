// Broker service for RFP management

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { RFP, Offer, RFPStatus, OfferStatus } from '@agentrunner/common';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3004;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// In-memory storage (in production, use database)
const rfps: Map<string, RFP> = new Map();
const offers: Map<string, Offer> = new Map();

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'broker'
  });
});

// Create RFP
app.post('/rfp', async (req, res) => {
  try {
    const { title, description, requirements, budget, deadline, issuer } = req.body;
    
    if (!title || !description || !budget || !issuer) {
      return res.status(400).json({ error: 'Title, description, budget, and issuer are required' });
    }

    const rfp: RFP = {
      id: `rfp_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      title,
      description,
      requirements: requirements || [],
      budget,
      deadline: new Date(deadline),
      issuer,
      status: RFPStatus.OPEN
    };

    rfps.set(rfp.id, rfp);
    
    res.json(rfp);
  } catch (error) {
    console.error('Error creating RFP:', error);
    res.status(500).json({ error: 'Failed to create RFP' });
  }
});

// Get RFPs
app.get('/rfps', async (req, res) => {
  try {
    const { status, issuer } = req.query;
    
    let filteredRfps = Array.from(rfps.values());
    
    if (status) {
      filteredRfps = filteredRfps.filter(rfp => rfp.status === status);
    }
    
    if (issuer) {
      filteredRfps = filteredRfps.filter(rfp => rfp.issuer === issuer);
    }
    
    res.json(filteredRfps);
  } catch (error) {
    console.error('Error getting RFPs:', error);
    res.status(500).json({ error: 'Failed to get RFPs' });
  }
});

// Get specific RFP
app.get('/rfp/:rfpId', async (req, res) => {
  try {
    const { rfpId } = req.params;
    const rfp = rfps.get(rfpId);
    
    if (!rfp) {
      return res.status(404).json({ error: 'RFP not found' });
    }
    
    res.json(rfp);
  } catch (error) {
    console.error('Error getting RFP:', error);
    res.status(500).json({ error: 'Failed to get RFP' });
  }
});

// Submit offer
app.post('/offer', async (req, res) => {
  try {
    const { rfpId, agentId, proposal, price, timeline } = req.body;
    
    if (!rfpId || !agentId || !proposal || !price) {
      return res.status(400).json({ error: 'RFP ID, agent ID, proposal, and price are required' });
    }

    const rfp = rfps.get(rfpId);
    if (!rfp) {
      return res.status(404).json({ error: 'RFP not found' });
    }

    if (rfp.status !== RFPStatus.OPEN) {
      return res.status(400).json({ error: 'RFP is not open for offers' });
    }

    const offer: Offer = {
      id: `offer_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      rfpId,
      agentId,
      proposal,
      price,
      timeline: timeline || 7, // Default 7 days
      status: OfferStatus.SUBMITTED
    };

    offers.set(offer.id, offer);
    
    res.json(offer);
  } catch (error) {
    console.error('Error submitting offer:', error);
    res.status(500).json({ error: 'Failed to submit offer' });
  }
});

// Get offers for RFP
app.get('/rfp/:rfpId/offers', async (req, res) => {
  try {
    const { rfpId } = req.params;
    const rfpOffers = Array.from(offers.values()).filter(offer => offer.rfpId === rfpId);
    
    res.json(rfpOffers);
  } catch (error) {
    console.error('Error getting offers:', error);
    res.status(500).json({ error: 'Failed to get offers' });
  }
});

// Accept offer
app.post('/offer/:offerId/accept', async (req, res) => {
  try {
    const { offerId } = req.params;
    const offer = offers.get(offerId);
    
    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    if (offer.status !== OfferStatus.SUBMITTED) {
      return res.status(400).json({ error: 'Offer is not in submitted status' });
    }

    // Update offer status
    offer.status = OfferStatus.ACCEPTED;
    offers.set(offerId, offer);

    // Update RFP status
    const rfp = rfps.get(offer.rfpId);
    if (rfp) {
      rfp.status = RFPStatus.AWARDED;
      rfps.set(offer.rfpId, rfp);
    }

    // Reject other offers for this RFP
    const otherOffers = Array.from(offers.values())
      .filter(o => o.rfpId === offer.rfpId && o.id !== offerId);
    
    otherOffers.forEach(otherOffer => {
      otherOffer.status = OfferStatus.REJECTED;
      offers.set(otherOffer.id, otherOffer);
    });
    
    res.json({ message: 'Offer accepted', offer });
  } catch (error) {
    console.error('Error accepting offer:', error);
    res.status(500).json({ error: 'Failed to accept offer' });
  }
});

// Reject offer
app.post('/offer/:offerId/reject', async (req, res) => {
  try {
    const { offerId } = req.params;
    const offer = offers.get(offerId);
    
    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    offer.status = OfferStatus.REJECTED;
    offers.set(offerId, offer);
    
    res.json({ message: 'Offer rejected', offer });
  } catch (error) {
    console.error('Error rejecting offer:', error);
    res.status(500).json({ error: 'Failed to reject offer' });
  }
});

// Close RFP
app.post('/rfp/:rfpId/close', async (req, res) => {
  try {
    const { rfpId } = req.params;
    const rfp = rfps.get(rfpId);
    
    if (!rfp) {
      return res.status(404).json({ error: 'RFP not found' });
    }

    rfp.status = RFPStatus.CLOSED;
    rfps.set(rfpId, rfp);
    
    res.json({ message: 'RFP closed', rfp });
  } catch (error) {
    console.error('Error closing RFP:', error);
    res.status(500).json({ error: 'Failed to close RFP' });
  }
});

// Error handling
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Broker service listening on port ${PORT}`);
});

export default app;
