import { getStore } from '@netlify/blobs';
import {
  SiteHttpError,
  getSiteConfigSnapshot,
  saveSiteConfigSnapshot,
  type SiteAttemptRecord,
  type SiteConfigRecord,
  type SiteDataStore,
} from '../../server/siteDataService.ts';

const CORS_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: CORS_HEADERS,
  });
}

let fallbackConfig: SiteConfigRecord | null = null;
const fallbackAttempts = new Map<string, SiteAttemptRecord>();

function createSiteDataStore(): SiteDataStore {
  try {
    const store = getStore({ name: 'lands-of-numeria-site', consistency: 'strong' });
    return {
      async getConfig() {
        return (await store.get('config:main', { type: 'json' })) as SiteConfigRecord | null;
      },
      async setConfig(config: SiteConfigRecord) {
        await store.setJSON('config:main', config);
      },
      async deleteConfig() {
        await store.delete('config:main');
      },
      async getAttempt(id: string) {
        return (await store.get(`attempt:${id}`, { type: 'json' })) as SiteAttemptRecord | null;
      },
      async setAttempt(attempt: SiteAttemptRecord) {
        await store.setJSON(`attempt:${attempt.id}`, attempt);
      },
      async listAttempts() {
        const { blobs } = await store.list({ prefix: 'attempt:' });
        const items = await Promise.all(
          blobs.map((b) => store.get(b.key, { type: 'json' }) as Promise<SiteAttemptRecord | null>)
        );
        return items.filter((item): item is SiteAttemptRecord => Boolean(item));
      },
      async deleteAttempt(id: string) {
        await store.delete(`attempt:${id}`);
      },
      async clearAttempts() {
        const { blobs } = await store.list({ prefix: 'attempt:' });
        await Promise.all(blobs.map((b) => store.delete(b.key)));
      },
    };
  } catch {
    return {
      async getConfig() {
        return fallbackConfig;
      },
      async setConfig(config: SiteConfigRecord) {
        fallbackConfig = config;
      },
      async deleteConfig() {
        fallbackConfig = null;
      },
      async getAttempt(id: string) {
        return fallbackAttempts.get(id) || null;
      },
      async setAttempt(attempt: SiteAttemptRecord) {
        fallbackAttempts.set(attempt.id, attempt);
      },
      async listAttempts() {
        return Array.from(fallbackAttempts.values());
      },
      async deleteAttempt(id: string) {
        fallbackAttempts.delete(id);
      },
      async clearAttempts() {
        fallbackAttempts.clear();
      },
    };
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const store = createSiteDataStore();

  try {
    if (req.method === 'GET') {
      const snapshot = await getSiteConfigSnapshot(store);
      return jsonResponse(snapshot, 200);
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      let body: Partial<SiteConfigRecord>;
      try {
        body = (await req.json()) as Partial<SiteConfigRecord>;
      } catch {
        throw new SiteHttpError(400, 'Format body JSON tidak valid.');
      }
      const saved = await saveSiteConfigSnapshot(store, body);
      return jsonResponse(saved, 200);
    }

    if (req.method === 'DELETE') {
      await store.deleteConfig();
      return jsonResponse({ ok: true }, 200);
    }

    return jsonResponse({ error: 'Metode tidak didukung.' }, 405);
  } catch (err: unknown) {
    if (err instanceof SiteHttpError) {
      return jsonResponse({ error: err.message }, err.statusCode);
    }
    const message = err instanceof Error ? err.message : 'Gagal mengakses konfigurasi guru.';
    console.error('Netlify site-config error:', message);
    return jsonResponse({ error: message }, 500);
  }
}
