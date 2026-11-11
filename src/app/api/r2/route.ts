import { NextResponse } from 'next/server';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { authenticate, quotaFor } from '@/lib/serverAuth';

// Hands a signed-in person short-lived links to upload, read, or delete THEIR OWN books in
// Backblaze B2. The secret key lives only here, on the server.
//
// (The folder is still called "r2" from an earlier version of this app. It just means "the cloud bucket".)

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BOOK_BYTES = 300 * 1024 * 1024;

function config() {
  const { B2_ENDPOINT, B2_KEY_ID, B2_APP_KEY, B2_BUCKET } = process.env;
  if (!B2_ENDPOINT || !B2_KEY_ID || !B2_APP_KEY || !B2_BUCKET) return null;
  const host = B2_ENDPOINT.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const region = host.split('.')[1] || 'us-west-004';
  const s3 = new S3Client({
    region,
    endpoint: `https://${host}`,
    forcePathStyle: true,
    credentials: { accessKeyId: B2_KEY_ID.trim(), secretAccessKey: B2_APP_KEY.trim() },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
  return { s3, bucket: B2_BUCKET.trim() };
}

const fail = (error: string, status: number, extra: Record<string, unknown> = {}) => NextResponse.json({ error, ...extra }, { status });

export async function POST(req: Request) {
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

  const cfg = config();
  if (!cfg) return fail('not_configured', 503);

  const me = await authenticate(req);
  if (!me) return fail('unauthorized', 401);

  let body: { action?: string; id?: string; size?: number };
  try {
    body = await req.json();
  } catch {
    return fail('bad_request', 400);
  }
  const { action, id, size } = body;
  if (!id || !UUID.test(id)) return fail('bad_id', 400);
  const bookId = id.toLowerCase();
  const mine = `${me.user.id}/${bookId}.pdf`; // where this person's new books live
  const legacy = `${bookId}.pdf`; // where books added before accounts live
  const { s3, bucket: Bucket } = cfg;

  try {
    if (action === 'put') {
      if (typeof size !== 'number' || !(size > 0)) return fail('bad_size', 400);
      if (size > MAX_BOOK_BYTES) return fail('too_big', 413, { limit: MAX_BOOK_BYTES });
      const q = await quotaFor(me.db);
      if (q.used + size > q.limit) return fail('quota', 413, { used: q.used, limit: q.limit });
      const url = await getSignedUrl(s3, new PutObjectCommand({ Bucket, Key: mine, ContentType: 'application/pdf' }), { expiresIn: 60 * 15 });
      return NextResponse.json({ url, key: mine });
    }

    // Reading or deleting needs a book row that belongs to this person (the database's rules enforce that).
    const { data: row } = await me.db.from('books').select('id,file_path,storage').eq('id', bookId).maybeSingle();
    // The file is always found from the book's own id, never from a path someone typed in.
    const key = row ? (row.file_path === mine ? mine : row.file_path === legacy ? legacy : null) : null;

    if (action === 'get') {
      if (!row || row.storage !== 'r2') return fail('not_found', 404);
      if (!key) return fail('forbidden', 403);
      const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket, Key: key }), { expiresIn: 60 * 60 * 2 });
      return NextResponse.json({ url });
    }
    if (action === 'delete') {
      const target = row ? key : mine; // no row yet = cleaning up after a failed upload: only their own folder
      if (!target) return fail('forbidden', 403);
      await s3.send(new DeleteObjectCommand({ Bucket, Key: target }));
      return NextResponse.json({ ok: true });
    }
    return fail('bad_action', 400);
  } catch (e) {
    console.error('Cloud storage error', e);
    return fail('storage_failed', 502);
  }
}