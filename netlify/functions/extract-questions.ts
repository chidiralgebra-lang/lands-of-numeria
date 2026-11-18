import {
  ExtractHttpError,
  extractQuestionsWithGemini,
  getGeminiClient,
  type ExtractQuestionsPayload,
} from '../../server/extractQuestions.ts';

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

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method === 'GET') {
    return jsonResponse({ configured: Boolean(getGeminiClient()) }, 200);
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Metode harus POST.' }, 405);
  }

  let payload: ExtractQuestionsPayload;
  try {
    payload = (await req.json()) as ExtractQuestionsPayload;
  } catch {
    return jsonResponse({ error: 'Format body JSON tidak valid.' }, 400);
  }

  try {
    const result = await extractQuestionsWithGemini(payload);
    return jsonResponse(result, 200);
  } catch (err: unknown) {
    if (err instanceof ExtractHttpError) {
      return jsonResponse({ error: err.message }, err.statusCode);
    }
    const message = err instanceof Error ? err.message : 'Gagal mengekstrak soal dari dokumen.';
    console.error('Netlify extract-questions error:', message);
    return jsonResponse({ error: message }, 500);
  }
}
