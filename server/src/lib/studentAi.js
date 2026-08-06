import { createOpenAI } from '@ai-sdk/openai';
import { createGroq } from '@ai-sdk/groq';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';

const MAX_MESSAGES = 24;
const MAX_MESSAGE_CHARS = 2000;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT = 40;

/** @type {Map<string, number[]>} */
const rateHits = new Map();

export function isAiConfigured() {
  return Boolean(
    process.env.GROQ_API_KEY
    || process.env.GOOGLE_GENERATIVE_AI_API_KEY
    || process.env.GEMINI_API_KEY
    || process.env.AI_GATEWAY_API_KEY
    || process.env.OPENAI_API_KEY,
  );
}

function isQuotaError(error) {
  const raw = [
    error?.message,
    error?.lastError?.message,
    error?.cause?.message,
    ...(Array.isArray(error?.errors) ? error.errors.map((e) => e?.message) : []),
  ].filter(Boolean).join(' ').toLowerCase();

  return (
    raw.includes('insufficient_quota')
    || raw.includes('credit_balance_exhausted')
    || raw.includes('quota')
    || raw.includes('resource_exhausted')
    || raw.includes('rate-limits')
    || raw.includes('billing')
    || error?.statusCode === 429
    || error?.lastError?.statusCode === 429
  );
}

/**
 * Build candidate models in priority order.
 * Free providers first. Override with AI_PROVIDER=groq|gemini|openai|gateway.
 */
function listCandidateModels() {
  const forced = String(process.env.AI_PROVIDER || '').trim().toLowerCase();
  const customModel = process.env.AI_MODEL?.trim() || '';

  const groqKey = process.env.GROQ_API_KEY?.trim();
  const geminiKey = (process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || '').trim();
  const gatewayKey = process.env.AI_GATEWAY_API_KEY?.trim();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();

  /** @type {{ name: string, model: import('ai').LanguageModel }[]} */
  const candidates = [];

  if (groqKey) {
    const groq = createGroq({ apiKey: groqKey });
    const models = customModel && forced === 'groq'
      ? [customModel]
      : [customModel || 'llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'gemma2-9b-it'].filter(
        (v, i, arr) => v && arr.indexOf(v) === i,
      );
    for (const id of models) {
      candidates.push({ name: `groq:${id}`, model: groq(id) });
    }
  }

  if (geminiKey) {
    const google = createGoogleGenerativeAI({ apiKey: geminiKey });
    // Prefer lite/flash models that usually keep free quota longer
    const models = customModel && (forced === 'gemini' || forced === 'google')
      ? [customModel]
      : [
        customModel || 'gemini-2.0-flash-lite',
        'gemini-2.0-flash',
        'gemini-1.5-flash',
      ].filter((v, i, arr) => v && arr.indexOf(v) === i);
    for (const id of models) {
      candidates.push({ name: `gemini:${id}`, model: google(id) });
    }
  }

  if (gatewayKey) {
    const provider = createOpenAI({
      apiKey: gatewayKey,
      baseURL: 'https://ai-gateway.vercel.sh/v1',
    });
    const id = customModel || 'openai/gpt-4o-mini';
    candidates.push({ name: `gateway:${id}`, model: provider(id) });
  }

  if (openaiKey) {
    const provider = createOpenAI({ apiKey: openaiKey });
    const id = customModel || 'gpt-4o-mini';
    candidates.push({ name: `openai:${id}`, model: provider(id) });
  }

  if (!forced || forced === 'auto') return candidates;

  const prefix = forced === 'google' ? 'gemini' : forced;
  const filtered = candidates.filter((c) => c.name.startsWith(`${prefix}:`));
  // If forced provider has no key, fall back to any available free option
  return filtered.length ? filtered : candidates;
}

export function checkAiRateLimit(userId) {
  const key = String(userId || 'anon');
  const now = Date.now();
  const recent = (rateHits.get(key) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    rateHits.set(key, recent);
    return false;
  }
  recent.push(now);
  rateHits.set(key, recent);
  return true;
}

export function normalizeChatMessages(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({
      role: m.role,
      content: String(m.content).trim().slice(0, MAX_MESSAGE_CHARS),
    }))
    .filter((m) => m.content)
    .slice(-MAX_MESSAGES);
}

export function buildStudentSystemPrompt({ student }) {
  const name = [student?.firstName, student?.lastName].filter(Boolean).join(' ') || 'student';
  const className = student?.class?.name || student?.registrationClass || 'their class';
  const grade = student?.class?.grade || '';

  return [
    'You are Racine AI, a friendly study tutor for École La RACINE (Rwanda primary & nursery school).',
    `You are helping ${name}${grade ? ` (grade ${grade})` : ''} in class ${className}.`,
    'LANGUAGE RULE (mandatory):',
    '- Always answer in the exact same language as the student\'s latest message.',
    '- If they write in English → reply only in English.',
    '- If they write in French → reply only in French.',
    '- If they write in Kinyarwanda → reply only in Kinyarwanda.',
    '- If they write in Kiswahili → reply only in Kiswahili.',
    '- Do NOT switch to Kinyarwanda (or any other language) when the student asked in English.',
    '- Ignore the school/app UI language; follow only the language of the question.',
    'Goals: explain concepts clearly, give step-by-step help, encourage curiosity, and keep answers age-appropriate.',
    'Rules:',
    '- Be warm, short, and clear. Use simple examples.',
    '- Format answers with Markdown: **bold** for key words, bullet lists, and fenced code blocks for code.',
    '- Keep code examples short and easy for primary/nursery students (or age-appropriate).',
    '- Help students learn: guide with hints and explanations; do not simply give full homework/test answers when they ask you to “do it for me”.',
    '- Never invent school fees, marks, attendance, or private student records. Suggest asking a teacher/secretary for official school info.',
    '- Refuse harmful, unsafe, or adult content. Redirect gently to school-safe topics.',
    '- If unsure, say so and suggest asking their teacher.',
  ].join('\n');
}

function friendlyAiError(error) {
  if (isQuotaError(error)) {
    return 'All free AI quotas are used up right now. Try again later, or add a Groq key (https://console.groq.com/keys).';
  }
  const raw = String(error?.message || error || '');
  const lower = raw.toLowerCase();
  if (lower.includes('invalid api key') || lower.includes('unauthorized') || lower.includes('401')) {
    return 'The AI API key is invalid. Check GROQ_API_KEY in server/.env.';
  }
  return raw.split('\n')[0] || 'AI tutor failed';
}

async function streamWithModel({ model, messages, system, res }) {
  const result = streamText({
    model,
    system,
    messages,
    temperature: 0.6,
    maxOutputTokens: 900,
    maxRetries: 1,
  });
  await result.pipeTextStreamToResponse(res);
}

/**
 * Stream an AI reply into an Express response as plain text chunks.
 * Tries Groq first, then other free providers if quota fails.
 */
export async function streamStudentAiReply({ messages, student, res }) {
  const candidates = listCandidateModels();
  if (!candidates.length) {
    const err = new Error(
      'AI tutor is not configured. Add a free GROQ_API_KEY from https://console.groq.com/keys',
    );
    err.status = 503;
    throw err;
  }

  const system = buildStudentSystemPrompt({ student });
  let lastError;

  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    try {
      await streamWithModel({
        model: candidate.model,
        messages,
        system,
        res,
      });
      return;
    } catch (error) {
      lastError = error;
      const canFailover = isQuotaError(error) && i < candidates.length - 1 && !res.headersSent;
      if (canFailover) {
        console.warn(`[ai-tutor] ${candidate.name} quota/rate limited — trying next provider`);
        continue;
      }
      break;
    }
  }

  const err = new Error(friendlyAiError(lastError));
  err.status = isQuotaError(lastError) ? 429 : (lastError?.statusCode || lastError?.status || 502);
  throw err;
}
