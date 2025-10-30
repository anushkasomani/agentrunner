// frontend/app/api/make-payment/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
// adjust the relative path as per your repo layout
import { makePayment } from '../../../../services/api-gateway/src/run';

export async function POST(req: Request) {
  try {
    const { invoice } = await req.json();
    if (!invoice) {
      return NextResponse.json({ error: 'Missing invoice' }, { status: 400 });
    }

    const res = await makePayment(invoice);
    return NextResponse.json(res);
  } catch (err: any) {
    console.error('make-payment error:', err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
