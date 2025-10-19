// API Gateway service

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createProxyMiddleware } from 'http-proxy-middleware';
import rateLimit from 'express-rate-limit';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(limiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'api-gateway',
    services: {
      runner: process.env.RUNNER_URL || 'http://localhost:3001',
      planner: process.env.PLANNER_URL || 'http://localhost:3002',
      merchant: process.env.X402_MERCHANT_URL || 'http://localhost:3003',
      broker: process.env.BROKER_URL || 'http://localhost:3004',
      certifier: process.env.CERTIFIER_URL || 'http://localhost:3005'
    }
  });
});

// Service discovery endpoint
app.get('/services', (req, res) => {
  res.json({
    services: {
      runner: {
        url: process.env.RUNNER_URL || 'http://localhost:3001',
        description: 'Agent execution runner service',
        endpoints: ['/execute', '/status', '/receipts', '/merkle']
      },
      planner: {
        url: process.env.PLANNER_URL || 'http://localhost:3002',
        description: 'OpenAI-based planning service',
        endpoints: ['/plan', '/validate']
      },
      merchant: {
        url: process.env.X402_MERCHANT_URL || 'http://localhost:3003',
        description: '402 payment challenge service',
        endpoints: ['/challenge', '/verify', '/refund']
      },
      broker: {
        url: process.env.BROKER_URL || 'http://localhost:3004',
        description: 'RFP broker service',
        endpoints: ['/rfp', '/offer']
      },
      certifier: {
        url: process.env.CERTIFIER_URL || 'http://localhost:3005',
        description: 'Agent certification service',
        endpoints: ['/certify', '/certification']
      }
    }
  });
});

// Proxy to Runner service
app.use('/api/runner', createProxyMiddleware({
  target: process.env.RUNNER_URL || 'http://localhost:3001',
  changeOrigin: true,
  pathRewrite: {
    '^/api/runner': ''
  },
  onError: (err, req, res) => {
    console.error('Runner service error:', err);
    res.status(503).json({ error: 'Runner service unavailable' });
  }
}));

// Proxy to Planner service
app.use('/api/planner', createProxyMiddleware({
  target: process.env.PLANNER_URL || 'http://localhost:3002',
  changeOrigin: true,
  pathRewrite: {
    '^/api/planner': ''
  },
  onError: (err, req, res) => {
    console.error('Planner service error:', err);
    res.status(503).json({ error: 'Planner service unavailable' });
  }
}));

// Proxy to Merchant service
app.use('/api/merchant', createProxyMiddleware({
  target: process.env.X402_MERCHANT_URL || 'http://localhost:3003',
  changeOrigin: true,
  pathRewrite: {
    '^/api/merchant': ''
  },
  onError: (err, req, res) => {
    console.error('Merchant service error:', err);
    res.status(503).json({ error: 'Merchant service unavailable' });
  }
}));

// Proxy to Broker service
app.use('/api/broker', createProxyMiddleware({
  target: process.env.BROKER_URL || 'http://localhost:3004',
  changeOrigin: true,
  pathRewrite: {
    '^/api/broker': ''
  },
  onError: (err, req, res) => {
    console.error('Broker service error:', err);
    res.status(503).json({ error: 'Broker service unavailable' });
  }
}));

// Proxy to Certifier service
app.use('/api/certifier', createProxyMiddleware({
  target: process.env.CERTIFIER_URL || 'http://localhost:3005',
  changeOrigin: true,
  pathRewrite: {
    '^/api/certifier': ''
  },
  onError: (err, req, res) => {
    console.error('Certifier service error:', err);
    res.status(503).json({ error: 'Certifier service unavailable' });
  }
}));

// Unified API endpoints
app.post('/api/execute', async (req, res) => {
  try {
    const response = await fetch(`${process.env.RUNNER_URL || 'http://localhost:3001'}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error executing plan:', error);
    res.status(500).json({ error: 'Failed to execute plan' });
  }
});

app.post('/api/plan', async (req, res) => {
  try {
    const response = await fetch(`${process.env.PLANNER_URL || 'http://localhost:3002'}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error generating plan:', error);
    res.status(500).json({ error: 'Failed to generate plan' });
  }
});

// Error handling
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(PORT, () => {
  console.log(`API Gateway listening on port ${PORT}`);
});

export default app;


