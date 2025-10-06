import { NextResponse } from 'next/server';
import { generateSumUpDeepLink } from '@/lib/api';
import type { SumUpDeepLinkPayload } from '@plan5/types';

export async function POST(request: Request) {
  const payload = (await request.json()) as SumUpDeepLinkPayload;
  const link = await generateSumUpDeepLink(payload);
  return NextResponse.json({ link });
}
