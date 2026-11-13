import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { authenticate } from '@/lib/serverAuth';
import { accountFiles, BookRow } from '@/lib/accountFiles';

// Lets someone delete their own account, along with everything in it.
// Needs SUPABASE_SERVICE_ROLE_KEY (a server-only secret: never put it in a NEXT_PUBLIC_ variable).

export const dynamic = 'force-dynamic';

function b2() {
  const { B2_ENDPOINT, B2_KEY_ID, B2_APP_KEY, B2_BUCKET } = process.env;
  if (!B2_ENDPOINT || !B2_KEY_ID || !B2_APP_KEY || !B2_BUCKET) return null;
  const host = B2_ENDPOINT.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const s3 = new S3Client({
    region: host.split('.')[1] || 'us-west-004',
    endpoint: `https://${host}`,
    forcePathStyle: true,
    credentials: { accessKeyId: B2_KEY_ID.trim(), secretAccessKey: B2_APP_KEY.trim() },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
  return { s3, bucket: B2_BUCKET.trim() };
}

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function DELETE(req: Request) {
  // Only this app's own pages may call this from a browser.
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return fail('forbidden', 403);
    } catch {
      return fail('forbidden', 403);
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return fail('not_configured', 503);

  const me = await authenticate(req);
  if (!me) return fail('unauthorized', 401);

  let body: { confirm?: string };
  try {
    body = await req.json();
  } catch {
    return fail('bad_request', 400);
  }
  if ((body.confirm || '').trim().toUpperCase() !== 'DELETE') return fail('not_confirmed', 400);

  // The owner's account can't be deleted from here.
  const isAdmin = await Promise.resolve(me.db.rpc('am_i_admin')).then(({ data }) => data === true).catch(() => false);
  if (isAdmin) return fail('owner', 403);

  const uid = me.user.id;
  const books: BookRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await me.db.from('books').select('id,file_path,cover_path,storage').range(from, from + 999);
    if (error) return fail('read_failed', 502);
    books.push(...((data as BookRow[]) ?? []));
    if (!data || data.length < 1000) break;
  }

  const svc = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

  // 1. The account first. Every note, highlight, book and collection goes with it.
  const { error } = await svc.auth.admin.deleteUser(uid);
  if (error) return fail('delete_failed', 502);

  // 2. Then their files. If a file can't be removed the account is still gone; it is only logged.
  const { b2: b2Keys, supabase: supa } = accountFiles(uid, books);
  try {
    const bucket = svc.storage.from('books');
    const extra: string[] = [];
    for (const dir of [uid, `${uid}/covers`]) {
      const { data } = await bucket.list(dir, { limit: 1000 });
      (data ?? []).forEach((f) => f.id && extra.push(`${dir}/${f.name}`));
    }
    const paths = [...new Set([...supa, ...extra])];
    for (let i = 0; i < paths.length; i += 100) await bucket.remove(paths.slice(i, i + 100));
  } catch (e) {
    console.error('Could not remove some stored files', e);
  }
  const cfg = b2();
  if (cfg) {
    await Promise.allSettled(
      b2Keys.map((Key) => cfg.s3.send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key }), { abortSignal: AbortSignal.timeout(6000) }))
    );
  }
  return NextResponse.json({ ok: true });
}