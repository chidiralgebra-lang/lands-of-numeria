import { Difficulty, Question, QuestionType } from '../types/game';

export interface EvaluationResult {
  isCorrect: boolean;
  pendingTeacherReview?: boolean;
  normalizedInput: string;
  feedbackText: string;
}

function parseNumericExpression(raw: string): number | null {
  let s = raw.trim().toLowerCase();
  if (!s) return null;

  // Strip common Indonesian units at the end
  s = s
    .replace(/\s*(cm²|cm2|cm³|cm3|m²|m2|m³|m3|km|cm|mm|m|liter|l|kg|gram|g|detik|menit|jam|koin|derajat|°|buah|kantong)\s*$/i, '')
    .trim();

  // Replace Indonesian comma decimal with dot
  s = s.replace(/,/g, '.');

  // Percentage e.g. 25% -> 0.25
  if (/^-?\d+(\.\d+)?%$/.test(s)) {
    const val = parseFloat(s.slice(0, -1));
    return Number.isFinite(val) ? val / 100 : null;
  }

  // Mixed fraction e.g. "2 1/2" or "-1 3/4"
  const mixedMatch = s.match(/^(-?\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1], 10);
    const num = parseInt(mixedMatch[2], 10);
    const den = parseInt(mixedMatch[3], 10);
    if (den !== 0) {
      return whole >= 0 ? whole + num / den : whole - num / den;
    }
  }

  // Simple fraction e.g. "3/4" or "-2/5"
  const fracMatch = s.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/);
  if (fracMatch) {
    const num = parseFloat(fracMatch[1]);
    const den = parseFloat(fracMatch[2]);
    if (den !== 0 && Number.isFinite(num) && Number.isFinite(den)) {
      return num / den;
    }
  }

  // Standard number
  if (/^[+-]?\d+(\.\d+)?$/.test(s)) {
    const val = parseFloat(s);
    return Number.isFinite(val) ? val : null;
  }

  return null;
}

function normalizeText(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/,/g, '.')
    .replace(/\s+/g, ' ');
}

export function evaluateAnswer(question: Question, rawAnswer: string): EvaluationResult {
  const trimmed = rawAnswer.trim();
  if (!trimmed) {
    return {
      isCorrect: false,
      normalizedInput: '',
      feedbackText: 'Jawaban belum diisi.',
    };
  }

  if (question.type === 'uraian') {
    // Essay questions are never auto-graded as objectively complete based on a single keyword.
    // We mark them for teacher rubric review and give supportive battle acknowledgment.
    return {
      isCorrect: true,
      pendingTeacherReview: true,
      normalizedInput: trimmed,
      feedbackText:
        'Jawaban uraian terkirim! Nilai akademik akan ditinjau guru menggunakan rubrik penilaian.',
    };
  }

  if (question.type === 'pilihan_ganda' || question.type === 'benar_salah') {
    const matched = normalizeText(trimmed) === normalizeText(question.correctAnswer);
    return {
      isCorrect: matched,
      normalizedInput: trimmed,
      feedbackText: matched
        ? 'Tepat sekali! Serangan berhasil dilancarkan!'
        : `Belum tepat. Jawaban yang benar adalah ${question.correctAnswer}.`,
    };
  }

  // Isian numerik / teks singkat
  const normInput = normalizeText(trimmed);
  const normKey = normalizeText(question.correctAnswer);
  if (normInput === normKey) {
    return {
      isCorrect: true,
      normalizedInput: trimmed,
      feedbackText: 'Jawaban tepat!',
    };
  }

  if (question.acceptedAlternatives?.some((alt) => normalizeText(alt) === normInput)) {
    return {
      isCorrect: true,
      normalizedInput: trimmed,
      feedbackText: 'Jawaban tepat!',
    };
  }

  // Numeric & fraction equivalence check
  const inputNum = parseNumericExpression(trimmed);
  const targetNum =
    typeof question.numericValue === 'number'
      ? question.numericValue
      : parseNumericExpression(question.correctAnswer);

  if (inputNum !== null && targetNum !== null) {
    const tol = typeof question.tolerance === 'number' ? question.tolerance : 1e-4;
    if (Math.abs(inputNum - targetNum) <= tol) {
      return {
        isCorrect: true,
        normalizedInput: trimmed,
        feedbackText: 'Nilai numerik/pecahan setara dan tepat!',
      };
    }
  }

  return {
    isCorrect: false,
    normalizedInput: trimmed,
    feedbackText: `Kurang tepat. Kunci jawaban: ${question.correctAnswer}${
      question.unit && !question.correctAnswer.includes(question.unit) ? ' ' + question.unit : ''
    }.`,
  };
}

export function generateCsvTemplate(): string {
  const headers = [
    'id',
    'subject',
    'gradeLevel',
    'topic',
    'subtopic',
    'indicator',
    'difficulty',
    'type',
    'prompt',
    'options',
    'correctAnswer',
    'acceptedAlternatives',
    'numericValue',
    'unit',
    'explanation',
    'rubric',
  ];
  const sampleRow1 = [
    'guru-01',
    'Matematika',
    'SMA/SMK Kelas X',
    'Eksponen, Akar & Logaritma',
    'Sifat Eksponen',
    'Menyederhanakan operasi bilangan berpangkat',
    'mudah',
    'pilihan_ganda',
    'Berapakah hasil dari (2^3 x 2^2) / 2?',
    '16|8|32|4',
    '16',
    '',
    '16',
    '',
    '2^3 x 2^2 = 2^5 = 32, lalu 32 / 2 = 16.',
    '',
  ];
  const sampleRow2 = [
    'guru-02',
    'Matematika',
    'SMA/SMK Kelas X',
    'Barisan, Deret & Rasio',
    'Barisan Aritmetika',
    'Menentukan suku ke-n barisan aritmetika',
    'sedang',
    'isian',
    'Diketahui barisan aritmetika 3, 7, 11, 15, ... Tentukan suku ke-6!',
    '',
    '23',
    'U6 = 23',
    '23',
    '',
    'a = 3, b = 4, sehingga U6 = 3 + 5(4) = 23.',
    '',
  ];
  const escapeCsv = (val: string) => `"${String(val).replace(/"/g, '""')}"`;
  return [headers, sampleRow1, sampleRow2].map((r) => r.map(escapeCsv).join(',')).join('\n');
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export function parseQuestionsFromCsv(csvText: string, sourceName = 'Impor CSV'): {
  questions: Question[];
  errors: string[];
} {
  const lines = csvText
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return { questions: [], errors: ['File CSV kosong atau tidak memiliki baris data.'] };
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const idx = (name: string) => headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());

  const promptIdx = idx('prompt');
  const answerIdx = idx('correctanswer');
  if (promptIdx === -1 || answerIdx === -1) {
    return {
      questions: [],
      errors: ['Header CSV wajib memiliki kolom "prompt" dan "correctAnswer".'],
    };
  }

  const questions: Question[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const get = (colName: string) => {
      const colI = idx(colName);
      return colI >= 0 && colI < cols.length ? cols[colI].trim() : '';
    };

    const prompt = get('prompt');
    const correctAnswer = get('correctAnswer');
    if (!prompt || !correctAnswer) {
      errors.push(`Baris ${i + 1}: pertanyaan atau kunci jawaban kosong.`);
      continue;
    }

    const rawType = get('type') as QuestionType;
    const validTypes: QuestionType[] = ['pilihan_ganda', 'benar_salah', 'isian', 'uraian'];
    const type: QuestionType = validTypes.includes(rawType) ? rawType : 'pilihan_ganda';

    const rawDiff = get('difficulty') as Difficulty;
    const validDiffs: Difficulty[] = ['mudah', 'sedang', 'sulit'];
    const difficulty: Difficulty = validDiffs.includes(rawDiff) ? rawDiff : 'sedang';

    const rawOpts = get('options');
    const options =
      type === 'benar_salah'
        ? ['Benar', 'Salah']
        : rawOpts
        ? rawOpts.split('|').map((o) => o.trim()).filter(Boolean)
        : undefined;

    if (type === 'pilihan_ganda' && (!options || options.length < 2)) {
      errors.push(`Baris ${i + 1}: soal pilihan ganda harus memiliki minimal 2 opsi (pisahkan dengan "|").`);
      continue;
    }

    const numRaw = get('numericValue');
    const numericValue = numRaw ? Number(numRaw.replace(',', '.')) : undefined;

    questions.push({
      id: get('id') || `csv-${Date.now()}-${i}`,
      subject: get('subject') || 'Matematika',
      gradeLevel: get('gradeLevel') || 'SMA/SMK Kelas X',
      topic: get('topic') || 'Eksponen, Akar & Logaritma',
      subtopic: get('subtopic') || 'Umum',
      indicator: get('indicator') || 'Indikator dari impor CSV',
      sourceDoc: sourceName,
      difficulty,
      type,
      prompt,
      options,
      correctAnswer,
      acceptedAlternatives: get('acceptedAlternatives')
        ? get('acceptedAlternatives').split('|').map((a) => a.trim()).filter(Boolean)
        : undefined,
      numericValue: Number.isFinite(numericValue) ? numericValue : undefined,
      unit: get('unit') || undefined,
      explanation: get('explanation') || `Kunci jawaban: ${correctAnswer}.`,
      rubric: get('rubric') || undefined,
      baseScore: 100,
      estimatedSeconds: difficulty === 'sulit' ? 60 : difficulty === 'sedang' ? 40 : 30,
      tags: ['impor-csv'],
      verificationStatus: 'tervalidasi_guru',
      isDemo: false,
    });
  }

  return { questions, errors };
}
