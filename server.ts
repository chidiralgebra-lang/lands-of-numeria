import express from 'express';
import type { Request, Response } from 'express';
import http from 'http';
import dotenv from 'dotenv';
import fs from 'fs/promises';
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
import {
  SiteHttpError,
  clearSiteAttempts,
  deleteSiteAttempt,
  getSiteConfigSnapshot,
  listSiteAttempts,
  saveSiteAttempt,
  saveSiteConfigSnapshot,
  updateSiteAttempt,
  type SiteAttemptRecord,
  type SiteConfigRecord,
  type SiteDataStore,
} from './server/siteDataService.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '16mb' }));

// CORS headers for /api/* so externally hosted static builds can also connect via VITE_API_BASE_URL
app.use('/api', (req: Request, res: Response, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
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
// 2. Persistent Teacher Config & Student Attempts
// ==========================================
const siteDataDir = path.resolve(__dirname, '.data', 'site-data');
const siteConfigPath = path.join(siteDataDir, 'config.json');
const siteAttemptsDir = path.join(siteDataDir, 'attempts');

let memSiteConfig: SiteConfigRecord | null = null;
const memSiteAttempts = new Map<string, SiteAttemptRecord>();

async function ensureDirSafe(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

const expressSiteDataStore: SiteDataStore = {
  async getConfig() {
    if (memSiteConfig) return memSiteConfig;
    try {
      const raw = await fs.readFile(siteConfigPath, 'utf-8');
      memSiteConfig = JSON.parse(raw) as SiteConfigRecord;
      return memSiteConfig;
    } catch {
      return null;
    }
  },
  async setConfig(config: SiteConfigRecord) {
    memSiteConfig = config;
    try {
      await ensureDirSafe(siteDataDir);
      await fs.writeFile(siteConfigPath, JSON.stringify(config), 'utf-8');
    } catch {
      // Keep in-memory copy if filesystem is read-only
    }
  },
  async deleteConfig() {
    memSiteConfig = null;
    try {
      await fs.unlink(siteConfigPath);
    } catch {
      // Ignore if absent
    }
  },
  async getAttempt(id: string) {
    const cached = memSiteAttempts.get(id);
    if (cached) return cached;
    try {
      const raw = await fs.readFile(path.join(siteAttemptsDir, `${id}.json`), 'utf-8');
      const parsed = JSON.parse(raw) as SiteAttemptRecord;
      memSiteAttempts.set(id, parsed);
      return parsed;
    } catch {
      return null;
    }
  },
  async setAttempt(attempt: SiteAttemptRecord) {
    memSiteAttempts.set(attempt.id, attempt);
    try {
      await ensureDirSafe(siteAttemptsDir);
      await fs.writeFile(
        path.join(siteAttemptsDir, `${attempt.id}.json`),
        JSON.stringify(attempt),
        'utf-8'
      );
    } catch {
      // Keep in-memory copy if filesystem is read-only
    }
  },
  async listAttempts() {
    try {
      const files = await fs.readdir(siteAttemptsDir);
      const fromDisk = await Promise.all(
        files
          .filter((f) => f.endsWith('.json'))
          .map(async (f) => {
            try {
              const raw = await fs.readFile(path.join(siteAttemptsDir, f), 'utf-8');
              const parsed = JSON.parse(raw) as SiteAttemptRecord;
              memSiteAttempts.set(parsed.id, parsed);
              return parsed;
            } catch {
              return null;
            }
          })
      );
      const map = new Map<string, SiteAttemptRecord>();
      fromDisk.forEach((a) => {
        if (a) map.set(a.id, a);
      });
      memSiteAttempts.forEach((a, k) => {
        if (!map.has(k)) map.set(k, a);
      });
      return Array.from(map.values());
    } catch {
      return Array.from(memSiteAttempts.values());
    }
  },
  async deleteAttempt(id: string) {
    memSiteAttempts.delete(id);
    try {
      await fs.unlink(path.join(siteAttemptsDir, `${id}.json`));
    } catch {
      // Ignore if absent
    }
  },
  async clearAttempts() {
    memSiteAttempts.clear();
    try {
      const files = await fs.readdir(siteAttemptsDir);
      await Promise.all(
        files
          .filter((f) => f.endsWith('.json'))
          .map((f) => fs.unlink(path.join(siteAttemptsDir, f)).catch(() => {}))
      );
    } catch {
      // Ignore if absent
    }
  },
};

function handleSiteError(res: Response, err: unknown) {
  if (err instanceof SiteHttpError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  const message = err instanceof Error ? err.message : 'Terjadi kesalahan pada penyimpanan data.';
  res.status(500).json({ error: message });
}

app.get('/api/site-config', async (_req: Request, res: Response) => {
  try {
    res.json(await getSiteConfigSnapshot(expressSiteDataStore));
  } catch (err) {
    handleSiteError(res, err);
  }
});

app.post('/api/site-config', async (req: Request, res: Response) => {
  try {
    res.json(await saveSiteConfigSnapshot(expressSiteDataStore, req.body));
  } catch (err) {
    handleSiteError(res, err);
  }
});

app.put('/api/site-config', async (req: Request, res: Response) => {
  try {
    res.json(await saveSiteConfigSnapshot(expressSiteDataStore, req.body));
  } catch (err) {
    handleSiteError(res, err);
  }
});

app.delete('/api/site-config', async (_req: Request, res: Response) => {
  try {
    await expressSiteDataStore.deleteConfig();
    res.json({ ok: true });
  } catch (err) {
    handleSiteError(res, err);
  }
});

app.get('/api/site-attempts', async (_req: Request, res: Response) => {
  try {
    res.json(await listSiteAttempts(expressSiteDataStore));
  } catch (err) {
    handleSiteError(res, err);
  }
});

app.post('/api/site-attempts', async (req: Request, res: Response) => {
  try {
    res.json(await saveSiteAttempt(expressSiteDataStore, req.body));
  } catch (err) {
    handleSiteError(res, err);
  }
});

app.put('/api/site-attempts/:id', async (req: Request, res: Response) => {
  try {
    res.json(await updateSiteAttempt(expressSiteDataStore, String(req.params.id || ''), req.body));
  } catch (err) {
    handleSiteError(res, err);
  }
});

app.patch('/api/site-attempts/:id', async (req: Request, res: Response) => {
  try {
    res.json(await updateSiteAttempt(expressSiteDataStore, String(req.params.id || ''), req.body));
  } catch (err) {
    handleSiteError(res, err);
  }
});

app.delete('/api/site-attempts/:id', async (req: Request, res: Response) => {
  try {
    res.json(await deleteSiteAttempt(expressSiteDataStore, String(req.params.id || '')));
  } catch (err) {
    handleSiteError(res, err);
  }
});

app.delete('/api/site-attempts', async (_req: Request, res: Response) => {
  try {
    res.json(await clearSiteAttempts(expressSiteDataStore));
  } catch (err) {
    handleSiteError(res, err);
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
