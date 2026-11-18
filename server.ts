import express from 'express';
import type { Request, Response } from 'express';
import http from 'http';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
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
} from './server/roomService.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '16mb' }));

// CORS headers for /api/* so externally hosted static builds can also connect via VITE_API_BASE_URL
app.use('/api', (req: Request, res: Response, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

// ==========================================
// 1. Online Class Battle (Server-Authoritative Rooms + SSE)
// ==========================================
const roomMetas = new Map<string, BattleRoomMeta>();
const roomParticipants = new Map<string, Map<string, RoomParticipant>>();
const roomSseClients = new Map<string, Set<Response>>();

const expressRoomStore: RoomStore = {
  async getRoomMeta(code: string) {
    return roomMetas.get(code) || null;
  },
  async setRoomMeta(meta: BattleRoomMeta) {
    roomMetas.set(meta.code, meta);
  },
  async hasRoom(code: string) {
    return roomMetas.has(code);
  },
  async getParticipant(code: string, participantId: string) {
    return roomParticipants.get(code)?.get(participantId) || null;
  },
  async setParticipant(code: string, participant: RoomParticipant) {
    let pMap = roomParticipants.get(code);
    if (!pMap) {
      pMap = new Map<string, RoomParticipant>();
      roomParticipants.set(code, pMap);
    }
    pMap.set(participant.id, participant);
  },
  async listParticipants(code: string) {
    return Array.from(roomParticipants.get(code)?.values() || []);
  },
};

async function broadcastRoom(code: string) {
  const clients = roomSseClients.get(code);
  if (!clients || clients.size === 0) return;
  try {
    const snapshot = await getRoomSessionSnapshot(expressRoomStore, code);
    const payload = JSON.stringify(snapshot);
    for (const client of clients) {
      client.write(`data: ${payload}\n\n`);
    }
  } catch {
    // Ignore broadcast error if room is absent
  }
}

function handleRoomError(res: Response, err: unknown) {
  if (err instanceof RoomHttpError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  const message = err instanceof Error ? err.message : 'Terjadi kesalahan pada sesi kelas.';
  res.status(500).json({ error: message });
}

app.post('/api/rooms', async (req: Request, res: Response) => {
  try {
    const snapshot = await createRoomSession(expressRoomStore, req.body as CreateRoomInput);
    res.json(snapshot);
  } catch (err: unknown) {
    handleRoomError(res, err);
  }
});

app.get('/api/rooms/:code', async (req: Request, res: Response) => {
  try {
    const code = normalizeRoomCode(String(req.params.code || ''));
    const participantId = typeof req.query.participantId === 'string' ? req.query.participantId : undefined;
    const snapshot = await getRoomSessionSnapshot(expressRoomStore, code, participantId);
    res.json(snapshot);
  } catch (err: unknown) {
    handleRoomError(res, err);
  }
});

app.get('/api/rooms/:code/stream', async (req: Request, res: Response) => {
  try {
    const code = normalizeRoomCode(String(req.params.code || ''));
    const snapshot = await getRoomSessionSnapshot(expressRoomStore, code);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let clients = roomSseClients.get(code);
    if (!clients) {
      clients = new Set<Response>();
      roomSseClients.set(code, clients);
    }
    clients.add(res);
    res.write(`data: ${JSON.stringify(snapshot)}\n\n`);

    req.on('close', () => {
      clients?.delete(res);
    });
  } catch {
    res.status(404).end();
  }
});

app.post('/api/rooms/:code/join', async (req: Request, res: Response) => {
  try {
    const code = normalizeRoomCode(String(req.params.code || ''));
    const result = await joinRoomSession(
      expressRoomStore,
      code,
      req.body as { name?: string; heroId?: string }
    );
    await broadcastRoom(code);
    res.json(result);
  } catch (err: unknown) {
    handleRoomError(res, err);
  }
});

app.post('/api/rooms/:code/start', async (req: Request, res: Response) => {
  try {
    const code = normalizeRoomCode(String(req.params.code || ''));
    const snapshot = await startRoomSession(expressRoomStore, code);
    await broadcastRoom(code);
    res.json(snapshot);
  } catch (err: unknown) {
    handleRoomError(res, err);
  }
});

app.post('/api/rooms/:code/answer', async (req: Request, res: Response) => {
  try {
    const code = normalizeRoomCode(String(req.params.code || ''));
    const result = await submitRoomAnswer(
      expressRoomStore,
      code,
      req.body as { participantId?: string; questionId?: string; answer?: string }
    );
    await broadcastRoom(code);
    res.json(result);
  } catch (err: unknown) {
    handleRoomError(res, err);
  }
});

app.post('/api/rooms/:code/end', async (req: Request, res: Response) => {
  try {
    const code = normalizeRoomCode(String(req.params.code || ''));
    const snapshot = await endRoomSession(expressRoomStore, code);
    await broadcastRoom(code);
    res.json(snapshot);
  } catch (err: unknown) {
    handleRoomError(res, err);
  }
});

// ==========================================
// 3. Vite Dev Middleware / Static Prod Server
// ==========================================
async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;
  const server = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`LANDS of NUMERIA server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
