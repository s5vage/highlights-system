import { NextResponse } from 'next/server';
import { authenticate, quotaFor } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

// How much storage the signed-in person may use, and how much they have used.
export async function GET(req: Request) {
  const me = await authenticate(req);
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const q = await quotaFor(me.db);
  return NextResponse.json({ limit: q.limit, used: q.used });
}