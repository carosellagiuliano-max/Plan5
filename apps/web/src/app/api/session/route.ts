import { NextResponse } from 'next/server';
import { sessionStatus } from '@/lib/api';

export async function GET() {
  const session = await sessionStatus();
  return NextResponse.json(session, {
    headers: {
      'Cache-Control': 'no-store'
    }
  });
}
