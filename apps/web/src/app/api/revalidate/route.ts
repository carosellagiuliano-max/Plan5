import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';

export async function POST(request: Request) {
  const secret = request.headers.get('x-netlify-signature');
  if (!process.env.REVALIDATE_SECRET || secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { path, tag } = await request.json();
  if (path) {
    revalidatePath(path);
  }
  if (tag) {
    revalidateTag(tag);
  }
  return NextResponse.json({ status: 'ok', revalidated: { path, tag } });
}
