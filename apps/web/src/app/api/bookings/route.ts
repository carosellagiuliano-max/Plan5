import { NextResponse } from 'next/server';
import { createBooking } from '@/lib/api';
import type { BookingPayload } from '@plan5/types';

export async function POST(request: Request) {
  const payload = (await request.json()) as BookingPayload;
  const response = await createBooking(payload);
  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 'no-store'
    }
  });
}
