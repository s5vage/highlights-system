import { NextResponse } from 'next/server';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Hands the browser short-lived links to upload, read, or delete a book in
// Backblaze B2 (an S3-compatible bucket). The secret key lives only here, on
// the server. It is never sent to the browser.
//
// (The folder is still called "r2" from an earlier version of this app. The
// name doesn't matter, it just means "the cloud bucket".)

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function config() {
  const { B2_ENDPOINT, B2_KEY_ID, B2_APP_KEY, B2_BUCKET } = process.env;
  if (!B2_ENDPOINT || !B2_KEY_ID || !B2_APP_KEY || !B2_BUCKET) return null;

  // Accept "s3.us-west-004.backblazeb2.com" with or without https://
  const host = B2_ENDPOINT.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const region = host.split('.')[1] || 'us-west-004';

  const s3 = new S3Client({
    region,
    endpoint: `https://${host}`,
    forcePathStyle: true,
    credentials: { accessKeyId: B2_KEY_ID.trim(), secretAccessKey: B2_APP_KEY.trim() },
    // Newer SDK versions add checksum headers that S3-compatible stores reject on presigned links.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
  return { s3, bucket: B2_BUCKET.trim() };
}

export async function POST(req: Request) {
  // Only this app's own pages may call this from a browser.
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    } catch {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
  }

  const cfg = config();
  if (!cfg) return NextResponse.json({ error: 'not_configured' }, { status: 503 });

  let body: { action?: string; id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const { action, id } = body;
  if (!id || !UUID.test(id)) return NextResponse.json({ error: 'bad_id' }, { status: 400 });
  const Key = `${id.toLowerCase()}.pdf`;
  const { s3, bucket: Bucket } = cfg;

  try {
    if (action === 'put') {
      const url = await getSignedUrl(
        s3,
        new PutObjectCommand({ Bucket, Key, ContentType: 'application/pdf' }),
        { expiresIn: 60 * 15 }
      );
      return NextResponse.json({ url });
    }
    if (action === 'get') {
      const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket, Key }), { expiresIn: 60 * 60 * 2 });
      return NextResponse.json({ url });
    }
    if (action === 'delete') {
      await s3.send(new DeleteObjectCommand({ Bucket, Key }));
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'bad_action' }, { status: 400 });
  } catch (e) {
    console.error('Cloud storage error', e);
    return NextResponse.json({ error: 'storage_failed' }, { status: 502 });
  }
}