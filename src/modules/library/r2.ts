import { supabase } from '@/lib/supabase';

export class R2NotConfigured extends Error {
  constructor() {
    super('Cloud storage isn’t set up yet. Add the storage keys to .env.local (and to Vercel), then try again.');
  }
}

const gb = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : `${Math.round(n / 1e6)} MB`);

// Every request to our server carries the signed-in person's token.
async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { authorization: `Bearer ${token}` } : {};
}

// Asks our own server for a short-lived link to upload, read, or delete one of your books.
export async function r2(action: 'put' | 'get' | 'delete', id: string, size?: number): Promise<{ url?: string; key?: string }> {
  const res = await fetch('/api/r2', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ action, id, size }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (body?.error === 'not_configured') throw new R2NotConfigured();
    if (body?.error === 'unauthorized') throw new Error('Your session ended. Please sign in again.');
    if (body?.error === 'quota') {
      throw new Error(`Not enough space: ${gb(body.used)} of ${gb(body.limit)} used, and this book is ${gb(size ?? 0)}. Delete some books first.`);
    }
    if (body?.error === 'too_big') throw new Error('Books can be up to 300 MB each.');
    throw new Error('Couldn’t reach cloud storage. Try again in a moment.');
  }
  return res.json();
}

// How much storage you are allowed (the server decides).
export async function fetchQuota(): Promise<number | null> {
  try {
    const res = await fetch('/api/quota', { headers: await authHeader() });
    if (!res.ok) return null;
    const j = await res.json();
    return typeof j.limit === 'number' ? j.limit : null;
  } catch {
    return null;
  }
}

// Uploads straight from the browser to cloud storage, reporting real progress.
export function putWithProgress(url: string, file: File, onProgress: (fraction: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', 'application/pdf');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`The upload was refused by cloud storage (${xhr.status}). Check your Backblaze keys.`));
    xhr.onerror = () =>
      reject(new Error('The upload was blocked. Check that your Backblaze bucket’s CORS rules allow this site.'));
    xhr.send(file);
  });
}