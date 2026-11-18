import { getStore } from '@netlify/blobs';
import {
  RoomHttpError,
  createRoomSession,
  endRoomSession,
  getRoomSessionSnapshot,
  joinRoomSession,
  normalizeRoomCode,
  startRoomSession,
  submitRoomAnswer,
  type BattleRoomMeta,
  type CreateRoomInput,
  type RoomParticipant,
  type RoomStore,
} from '../../server/roomService.ts';

const CORS_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: CORS_HEADERS,
  });
}

// Fallback in-memory map if invoked outside Netlify Blobs runtime
const fallbackRooms = new Map<string, BattleRoomMeta>();
const fallbackParticipants = new Map<string, Map<string, RoomParticipant>>();

function createRoomStore(): RoomStore {
  try {
    const store = getStore({ name: 'lands-of-numeria-rooms', consistency: 'strong' });
    return {
      async getRoomMeta(code: string) {
        return (await store.get(`room:${code}`, { type: 'json' })) as BattleRoomMeta | null;
      },
      async setRoomMeta(meta: BattleRoomMeta) {
        await store.setJSON(`room:${meta.code}`, meta);
      },
      async hasRoom(code: string) {
        const existing = await store.get(`room:${code}`, { type: 'text' });
        return existing !== null;
      },
      async getParticipant(code: string, participantId: string) {
        return (await store.get(`participant:${code}:${participantId}`, {
          type: 'json',
        })) as RoomParticipant | null;
      },
      async setParticipant(code: string, participant: RoomParticipant) {
        await store.setJSON(`participant:${code}:${participant.id}`, participant);
      },
      async listParticipants(code: string) {
        const prefix = `participant:${code}:`;
        const { blobs } = await store.list({ prefix });
        const items = await Promise.all(
          blobs.map((b) => store.get(b.key, { type: 'json' }) as Promise<RoomParticipant | null>)
        );
        return items.filter((p): p is RoomParticipant => Boolean(p));
      },
    };
  } catch {
    return {
      async getRoomMeta(code: string) {
        return fallbackRooms.get(code) || null;
      },
      async setRoomMeta(meta: BattleRoomMeta) {
        fallbackRooms.set(meta.code, meta);
      },
      async hasRoom(code: string) {
        return fallbackRooms.has(code);
      },
      async getParticipant(code: string, participantId: string) {
        return fallbackParticipants.get(code)?.get(participantId) || null;
      },
      async setParticipant(code: string, participant: RoomParticipant) {
        let pMap = fallbackParticipants.get(code);
        if (!pMap) {
          pMap = new Map<string, RoomParticipant>();
          fallbackParticipants.set(code, pMap);
        }
        pMap.set(participant.id, participant);
      },
      async listParticipants(code: string) {
        return Array.from(fallbackParticipants.get(code)?.values() || []);
      },
    };
  }
}

async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new RoomHttpError(400, 'Format body JSON tidak valid.');
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  const subPath = url.pathname
    .replace(/^\/\.netlify\/functions\/rooms/, '')
    .replace(/^\/api\/rooms/, '')
    .replace(/^\/+|\/+$/g, '');
  const segments = subPath ? subPath.split('/').filter(Boolean) : [];
  const store = createRoomStore();

  try {
    // POST /api/rooms -> Create room
    if (segments.length === 0 && req.method === 'POST') {
      const body = await readJson<CreateRoomInput>(req);
      const snapshot = await createRoomSession(store, body);
      return jsonResponse(snapshot, 200);
    }

    if (segments.length >= 1) {
      const code = normalizeRoomCode(segments[0]);

      // GET /api/rooms/:code -> Snapshot
      if (segments.length === 1 && req.method === 'GET') {
        const participantId = url.searchParams.get('participantId') || undefined;
        const snapshot = await getRoomSessionSnapshot(store, code, participantId);
        return jsonResponse(snapshot, 200);
      }

      if (segments.length === 2) {
        const action = segments[1];

        // GET /api/rooms/:code/stream -> Serverless-safe SSE heartbeat response
        if (action === 'stream' && req.method === 'GET') {
          const snapshot = await getRoomSessionSnapshot(store, code);
          return new Response(`retry: 3000\ndata: ${JSON.stringify(snapshot)}\n\n`, {
            status: 200,
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Access-Control-Allow-Origin': '*',
            },
          });
        }

        // POST /api/rooms/:code/join
        if (action === 'join' && req.method === 'POST') {
          const body = await readJson<{ name?: string; heroId?: string }>(req);
          const result = await joinRoomSession(store, code, body);
          return jsonResponse(result, 200);
        }

        // POST /api/rooms/:code/start
        if (action === 'start' && req.method === 'POST') {
          const snapshot = await startRoomSession(store, code);
          return jsonResponse(snapshot, 200);
        }

        // POST /api/rooms/:code/answer
        if (action === 'answer' && req.method === 'POST') {
          const body = await readJson<{ participantId?: string; questionId?: string; answer?: string }>(req);
          const result = await submitRoomAnswer(store, code, body);
          return jsonResponse(result, 200);
        }

        // POST /api/rooms/:code/end
        if (action === 'end' && req.method === 'POST') {
          const snapshot = await endRoomSession(store, code);
          return jsonResponse(snapshot, 200);
        }
      }
    }

    return jsonResponse({ error: 'Endpoint sesi kelas tidak ditemukan.' }, 404);
  } catch (err: unknown) {
    if (err instanceof RoomHttpError) {
      return jsonResponse({ error: err.message }, err.statusCode);
    }
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan pada layanan sesi kelas.';
    console.error('Netlify rooms function error:', message);
    return jsonResponse({ error: message }, 500);
  }
}
