// Certifier service for agent certification

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { 
  CertificationStage, 
  CertificationStageType, 
  CertificationStatus 
} from '@agentrunner/common';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3005;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// In-memory storage (in production, use database)
const certifications: Map<string, CertificationStage[]> = new Map();

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'certifier'
  });
});

// Start certification process
app.post('/certify', async (req, res) => {
  try {
    const { agentId, agentCode, metadata } = req.body;
    
    if (!agentId || !agentCode) {
      return res.status(400).json({ error: 'Agent ID and code are required' });
    }

    const certificationId = `cert_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    
    // Initialize certification stages
    const stages: CertificationStage[] = [
      {
        stage: CertificationStageType.STATIC,
        status: CertificationStatus.PENDING,
        results: {},
        timestamp: new Date()
      },
      {
        stage: CertificationStageType.CONTRACT,
        status: CertificationStatus.PENDING,
        results: {},
        timestamp: new Date()
      },
      {
        stage: CertificationStageType.INTEGRATION,
        status: CertificationStatus.PENDING,
        results: {},
        timestamp: new Date()
      },
      {
        stage: CertificationStageType.SOAK,
        status: CertificationStatus.PENDING,
        results: {},
        timestamp: new Date()
      },
      {
        stage: CertificationStageType.CANARY,
        status: CertificationStatus.PENDING,
        results: {},
        timestamp: new Date()
      }
    ];

    certifications.set(certificationId, stages);
    
    // Start first stage
    await startCertificationStage(certificationId, CertificationStageType.STATIC);
    
    res.json({ 
      certificationId, 
      agentId, 
      stages: stages.map(s => ({ stage: s.stage, status: s.status }))
    });
  } catch (error) {
    console.error('Error starting certification:', error);
    res.status(500).json({ error: 'Failed to start certification' });
  }
});

// Get certification status
app.get('/certification/:certificationId', async (req, res) => {
  try {
    const { certificationId } = req.params;
    const stages = certifications.get(certificationId);
    
    if (!stages) {
      return res.status(404).json({ error: 'Certification not found' });
    }
    
    res.json({ certificationId, stages });
  } catch (error) {
    console.error('Error getting certification:', error);
    res.status(500).json({ error: 'Failed to get certification' });
  }
});

// Get certification results
app.get('/certification/:certificationId/results', async (req, res) => {
  try {
    const { certificationId } = req.params;
    const stages = certifications.get(certificationId);
    
    if (!stages) {
      return res.status(404).json({ error: 'Certification not found' });
    }
    
    const results = stages.map(stage => ({
      stage: stage.stage,
      status: stage.status,
      results: stage.results,
      timestamp: stage.timestamp
    }));
    
    res.json({ certificationId, results });
  } catch (error) {
    console.error('Error getting certification results:', error);
    res.status(500).json({ error: 'Failed to get certification results' });
  }
});

// Retry failed stage
app.post('/certification/:certificationId/retry/:stage', async (req, res) => {
  try {
    const { certificationId, stage } = req.params;
    const stages = certifications.get(certificationId);
    
    if (!stages) {
      return res.status(404).json({ error: 'Certification not found' });
    }

    const stageType = stage as CertificationStageType;
    const stageIndex = stages.findIndex(s => s.stage === stageType);
    
    if (stageIndex === -1) {
      return res.status(404).json({ error: 'Stage not found' });
    }

    // Reset stage status
    stages[stageIndex].status = CertificationStatus.PENDING;
    stages[stageIndex].timestamp = new Date();
    certifications.set(certificationId, stages);

    // Restart stage
    await startCertificationStage(certificationId, stageType);
    
    res.json({ message: 'Stage retry initiated', stage: stageType });
  } catch (error) {
    console.error('Error retrying stage:', error);
    res.status(500).json({ error: 'Failed to retry stage' });
  }
});

async function startCertificationStage(
  certificationId: string, 
  stage: CertificationStageType
): Promise<void> {
  const stages = certifications.get(certificationId);
  if (!stages) return;

  const stageIndex = stages.findIndex(s => s.stage === stage);
  if (stageIndex === -1) return;

  // Update status to running
  stages[stageIndex].status = CertificationStatus.RUNNING;
  stages[stageIndex].timestamp = new Date();
  certifications.set(certificationId, stages);

  // Simulate certification process
  setTimeout(async () => {
    const result = await runCertificationStage(stage);
    
    // Update stage with results
    stages[stageIndex].status = result.passed ? CertificationStatus.PASSED : CertificationStatus.FAILED;
    stages[stageIndex].results = result.results;
    stages[stageIndex].timestamp = new Date();
    certifications.set(certificationId, stages);

    // If stage passed and there's a next stage, start it
    if (result.passed) {
      const nextStage = getNextStage(stage);
      if (nextStage) {
        await startCertificationStage(certificationId, nextStage);
      }
    }
  }, getStageDuration(stage));
}

async function runCertificationStage(stage: CertificationStageType): Promise<{
  passed: boolean;
  results: any;
}> {
  // Mock certification logic
  const mockResults = {
    [CertificationStageType.STATIC]: {
      codeQuality: 95,
      securityScore: 88,
      complexityScore: 72,
      testCoverage: 85
    },
    [CertificationStageType.CONTRACT]: {
      contractVerified: true,
      gasOptimization: 92,
      securityAudit: 'passed',
      complianceCheck: 'passed'
    },
    [CertificationStageType.INTEGRATION]: {
      integrationTests: 'passed',
      performanceScore: 89,
      compatibilityCheck: 'passed',
      errorHandling: 'passed'
    },
    [CertificationStageType.SOAK]: {
      uptime: 99.9,
      memoryLeaks: 'none',
      performanceStability: 'stable',
      errorRate: 0.01
    },
    [CertificationStageType.CANARY]: {
      canaryDeployment: 'successful',
      userFeedback: 'positive',
      performanceMetrics: 'within_range',
      rollbackRequired: false
    }
  };

  const results = mockResults[stage] || {};
  const passed = Math.random() > 0.2; // 80% pass rate for demo

  return { passed, results };
}

function getNextStage(currentStage: CertificationStageType): CertificationStageType | null {
  const stageOrder = [
    CertificationStageType.STATIC,
    CertificationStageType.CONTRACT,
    CertificationStageType.INTEGRATION,
    CertificationStageType.SOAK,
    CertificationStageType.CANARY
  ];

  const currentIndex = stageOrder.indexOf(currentStage);
  return currentIndex < stageOrder.length - 1 ? stageOrder[currentIndex + 1] : null;
}

function getStageDuration(stage: CertificationStageType): number {
  const durations = {
    [CertificationStageType.STATIC]: 5000,
    [CertificationStageType.CONTRACT]: 10000,
    [CertificationStageType.INTEGRATION]: 15000,
    [CertificationStageType.SOAK]: 30000,
    [CertificationStageType.CANARY]: 20000
  };

  return durations[stage] || 5000;
}

// Error handling
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Certifier service listening on port ${PORT}`);
});

export default app;

