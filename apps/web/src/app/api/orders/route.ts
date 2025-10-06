import { NextResponse } from 'next/server';
import { createOrder } from '@/lib/api';
import type { OrderPayload } from '@plan5/types';

export async function POST(request: Request) {
  const payload = (await request.json()) as OrderPayload;
  const response = await createOrder(payload);
  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 'no-store',
      'x-plan5-idempotency': response.orderId
    }
  });
}
