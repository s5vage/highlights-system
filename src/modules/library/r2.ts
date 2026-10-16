export class R2NotConfigured extends Error {
  constructor() {
    super('Cloud storage isn’t set up yet. Add the storage keys to .env.local (and to Vercel), then try again.');
  }
}

// Asks our own server for a short-lived link to upload, read, or delete a book in cloud storage.
export async function r2(action: 'put' | 'get' | 'delete', id: string): Promise<{ url?: string }> {
  const res = await fetch('/api/r2', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, id }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (body?.error === 'not_configured') throw new R2NotConfigured();
    throw new Error('Couldn’t reach cloud storage. Try again in a moment.');
  }
  return res.json();
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