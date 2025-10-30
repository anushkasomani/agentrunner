import { NextRequest, NextResponse } from 'next/server';

// Reuse the server-side runner to execute python agent
import { runPythonAgent } from '../../../../services/api-gateway/src/runcd';

export async function POST(request: NextRequest) {
  try {
    const { ohlcv, metadataUri } = await request.json();
    if (!metadataUri) {
      return NextResponse.json({ ok: false, error: 'metadataUri required' }, { status: 400 });
    }
    const result = await runPythonAgent(ohlcv, metadataUri);
    console.log("agent executed successfully", result);
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}


