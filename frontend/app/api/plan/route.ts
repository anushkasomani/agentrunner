import { NextRequest, NextResponse } from 'next/server';

const PLANNER_URL = process.env.PLANNER_URL || 'http://localhost:7002';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('[API] Forwarding to planner:', PLANNER_URL, body);

    const response = await fetch(`${PLANNER_URL}/plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      let errorDetail = '';
      try {
        const errorData = await response.json();
        errorDetail = JSON.stringify(errorData, null, 2);
      } catch (e) {
        try {
          errorDetail = await response.text();
        } catch (e2) {
          errorDetail = 'Could not parse error response';
        }
      }
      console.error('[API] Planner error:', response.status);
      console.error('[API] Planner response:', errorDetail);
      console.error('[API] Request body was:', JSON.stringify(body, null, 2));
      return NextResponse.json(
        { error: `Planner returned ${response.status}: ${errorDetail}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[API] Planner response:', data);

    return NextResponse.json(data);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[API] Error calling planner:', errorMessage);
    return NextResponse.json(
      { error: `Failed to call planner: ${errorMessage}` },
      { status: 500 }
    );
  }
}
