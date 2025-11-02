import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Note: Docker-based python agent execution is not available on Vercel serverless
// This route should call an external API service that can run Docker containers
const PYTHON_AGENT_API_URL = process.env.PYTHON_AGENT_API_URL || 'http://localhost:7065';

export async function POST(request: NextRequest) {
  try {
    const { ohlcv, metadataUri } = await request.json();
    if (!metadataUri) {
      return NextResponse.json({ ok: false, error: 'metadataUri required' }, { status: 400 });
    }

    // Call external API service for Python agent execution
    // Docker containers cannot run on Vercel serverless functions
    try {
      const response = await fetch(`${PYTHON_AGENT_API_URL}/python-agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ohlcv, metadataUri }),
      });

      if (!response.ok) {
        throw new Error(`External API returned ${response.status}`);
      }

      const result = await response.json();
      console.log("agent executed successfully", result);
      return NextResponse.json({ ok: true, ...result });
    } catch (apiError: any) {
      // If external API is not available, return a helpful error
      return NextResponse.json({ 
        ok: false, 
        error: `Python agent service unavailable. Docker execution requires an external API service. Error: ${apiError.message}` 
      }, { status: 503 });
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}


