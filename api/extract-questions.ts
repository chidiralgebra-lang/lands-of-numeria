import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  ExtractHttpError,
  extractQuestionsWithGemini,
  type ExtractQuestionsPayload,
} from '../server/extractQuestions.ts';

function sendJson(res: ServerResponse, statusCode: number, body: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.end(JSON.stringify(body));
}

async function readJsonBody(req: IncomingMessage & { body?: unknown }): Promise<ExtractQuestionsPayload> {
  if (req.body && typeof req.body === 'object') {
    return req.body as ExtractQuestionsPayload;
  }
  const chunks: Uint8Array[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? (JSON.parse(raw) as ExtractQuestionsPayload) : {};
}

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse
): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Metode harus POST.' });
    return;
  }

  let payload: ExtractQuestionsPayload;
  try {
    payload = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { error: 'Format body JSON tidak valid.' });
    return;
  }

  try {
    const result = await extractQuestionsWithGemini(payload);
    sendJson(res, 200, result);
  } catch (err: unknown) {
    if (err instanceof ExtractHttpError) {
      sendJson(res, err.statusCode, { error: err.message });
      return;
    }
    const message = err instanceof Error ? err.message : 'Gagal mengekstrak soal dari dokumen.';
    console.error('Serverless extract-questions error:', message);
    sendJson(res, 500, { error: message });
  }
}
