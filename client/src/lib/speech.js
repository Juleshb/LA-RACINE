const VOICE_PREF_KEY = 'laracine_ai_auto_speak';
const SPEED_PREF_KEY = 'laracine_ai_speech_rate';

export const SPEECH_SPEEDS = [0.75, 1, 1.25, 1.5];

const listeners = new Set();
let tokenSeq = 0;

/** @type {null | {
 *  sentences: string[],
 *  index: number,
 *  rate: number,
 *  lang: string,
 *  status: 'idle' | 'playing' | 'paused' | 'ended',
 *  messageIndex: number | null,
 *  token: number,
 *  sessionId: number,
 * }} */
let player = null;

export function isSpeechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

export function getAutoSpeakPref() {
  try {
    return localStorage.getItem(VOICE_PREF_KEY) === '1';
  } catch {
    return false;
  }
}

export function setAutoSpeakPref(on) {
  try {
    localStorage.setItem(VOICE_PREF_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function getSpeechRatePref() {
  try {
    const n = Number(localStorage.getItem(SPEED_PREF_KEY));
    if (SPEECH_SPEEDS.includes(n)) return n;
  } catch {
    /* ignore */
  }
  return 1;
}

export function setSpeechRatePref(rate) {
  try {
    localStorage.setItem(SPEED_PREF_KEY, String(rate));
  } catch {
    /* ignore */
  }
}

export function plainTextForSpeech(raw) {
  return String(raw || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/^\s*>\s?/gm, '')
    .replace(/\|/g, ' ')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function splitSentences(text) {
  const cleaned = plainTextForSpeech(text);
  if (!cleaned) return [];
  const parts = cleaned
    .split(/(?<=[.!?…])\s+|\s*[;:]\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length) return parts;

  const chunks = [];
  let rest = cleaned;
  while (rest.length > 180) {
    let cut = rest.lastIndexOf(' ', 180);
    if (cut < 60) cut = 180;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

function scoreVoice(voice, langTag) {
  const vLang = (voice.lang || '').toLowerCase();
  const want = (langTag || 'en').toLowerCase();
  const wantPrimary = want.split('-')[0];
  let score = 0;
  if (vLang === want) score += 40;
  else if (vLang.startsWith(`${wantPrimary}-`) || vLang === wantPrimary) score += 28;
  if (/google|premium|enhanced|natural|neural/i.test(voice.name)) score += 8;
  if (voice.localService) score += 2;
  return score;
}

function pickVoice(langTag) {
  if (!isSpeechSupported()) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  if (!voices.length) return null;
  let best = null;
  let bestScore = -1;
  for (const voice of voices) {
    const score = scoreVoice(voice, langTag);
    if (score > bestScore) {
      best = voice;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : voices.find((v) => (v.lang || '').toLowerCase().startsWith('en')) || voices[0];
}

export function detectSpeechLang(text, appLanguage = 'en') {
  const sample = String(text || '').slice(0, 400);
  if (/[àâäéèêëïîôùûüçœæ]/i.test(sample)
    || /\b(le|la|les|des|une|est|pour|avec|bonjour|merci|comment|pourquoi)\b/i.test(sample)) {
    return 'fr-FR';
  }
  if (/\b(habari|asante|tafadhali|karibu|nina|unaweza|kwa nini|je)\b/i.test(sample)) {
    return 'sw-KE';
  }
  if (/\b(murakoze|amakuru|cyangwa|ndabizi|muraho|ese|ni iki)\b/i.test(sample)) {
    return 'rw-RW';
  }
  const map = {
    fr: 'fr-FR',
    rw: 'rw-RW',
    sw: 'sw-KE',
    en: 'en-US',
  };
  return map[appLanguage] || 'en-US';
}

export function warmSpeechVoices() {
  if (!isSpeechSupported()) return;
  window.speechSynthesis.getVoices();
  if (typeof window.speechSynthesis.onvoiceschanged !== 'undefined') {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices();
    };
  }
}

function emit() {
  const snapshot = getSpeechPlayerState();
  listeners.forEach((fn) => {
    try {
      fn(snapshot);
    } catch {
      /* ignore */
    }
  });
}

function estimateWordEnd(text, start) {
  const rest = String(text || '').slice(start);
  const match = rest.match(/^\S+/);
  return start + (match ? match[0].length : Math.min(1, rest.length));
}

export function getSpeechPlayerState() {
  if (!player || player.status === 'idle' || player.status === 'ended') {
    return {
      active: false,
      status: player?.status || 'idle',
      index: 0,
      total: 0,
      rate: player?.rate ?? getSpeechRatePref(),
      messageIndex: null,
      canPrev: false,
      canNext: false,
      preview: '',
      sessionId: player?.sessionId || 0,
      sentences: [],
      wordStart: 0,
      wordEnd: 0,
    };
  }
  return {
    active: true,
    status: player.status,
    index: player.index,
    total: player.sentences.length,
    rate: player.rate,
    messageIndex: player.messageIndex,
    canPrev: player.index > 0,
    canNext: player.index < player.sentences.length - 1,
    preview: player.sentences[player.index] || '',
    sessionId: player.sessionId,
    sentences: player.sentences,
    wordStart: player.wordStart || 0,
    wordEnd: player.wordEnd || 0,
  };
}

export function subscribeSpeechPlayer(listener) {
  listeners.add(listener);
  listener(getSpeechPlayerState());
  return () => listeners.delete(listener);
}

function hardCancelSynth() {
  if (!isSpeechSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}

function speakCurrentSentence() {
  if (!player || !isSpeechSupported()) return;
  const text = player.sentences[player.index];
  if (!text) {
    player.status = 'ended';
    emit();
    return;
  }

  const myToken = ++tokenSeq;
  player.token = myToken;
  player.wordStart = 0;
  player.wordEnd = 0;
  hardCancelSynth();

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = player.lang;
  utter.rate = Math.min(1.6, Math.max(0.6, player.rate));
  utter.pitch = 1;
  const voice = pickVoice(player.lang);
  if (voice) utter.voice = voice;

  utter.onstart = () => {
    if (!player || player.token !== myToken) return;
    player.status = 'playing';
    player.wordStart = 0;
    player.wordEnd = estimateWordEnd(text, 0);
    emit();
  };

  utter.onboundary = (event) => {
    if (!player || player.token !== myToken) return;
    if (event.name && event.name !== 'word') return;
    const start = typeof event.charIndex === 'number' ? event.charIndex : 0;
    const end = typeof event.charLength === 'number' && event.charLength > 0
      ? start + event.charLength
      : estimateWordEnd(text, start);
    player.wordStart = start;
    player.wordEnd = end;
    emit();
  };

  utter.onend = () => {
    if (!player || player.token !== myToken) return;
    if (player.status === 'paused') return;
    if (player.index < player.sentences.length - 1) {
      player.index += 1;
      player.wordStart = 0;
      player.wordEnd = 0;
      emit();
      window.setTimeout(() => {
        if (player && player.token === myToken && player.status === 'playing') {
          speakCurrentSentence();
        }
      }, 50);
    } else {
      player.status = 'ended';
      emit();
      window.setTimeout(() => {
        if (player && player.token === myToken && player.status === 'ended') {
          player = null;
          emit();
        }
      }, 60);
    }
  };

  utter.onerror = () => {
    if (!player || player.token !== myToken) return;
    if (player.status === 'paused') return;
  };

  window.setTimeout(() => {
    if (!player || player.token !== myToken) return;
    try {
      try {
        window.speechSynthesis.resume();
      } catch {
        /* ignore */
      }
      window.speechSynthesis.speak(utter);
      player.status = 'playing';
      emit();
    } catch {
      player.status = 'ended';
      emit();
    }
  }, 40);
}

export function startSpeechPlayer({ raw, lang, rate, messageIndex = null, fromSentence = 0 }) {
  if (!isSpeechSupported()) return false;
  const sentences = splitSentences(raw);
  if (!sentences.length) return false;

  hardCancelSynth();
  player = {
    sentences,
    index: Math.max(0, Math.min(fromSentence, sentences.length - 1)),
    rate: rate ?? getSpeechRatePref(),
    lang: lang || 'en-US',
    status: 'playing',
    messageIndex,
    token: 0,
    sessionId: Date.now(),
    wordStart: 0,
    wordEnd: 0,
  };
  emit();
  speakCurrentSentence();
  return true;
}

export function pauseSpeechPlayer() {
  if (!player || !isSpeechSupported()) return;
  if (player.status !== 'playing') return;
  try {
    window.speechSynthesis.pause();
  } catch {
    hardCancelSynth();
  }
  player.status = 'paused';
  emit();
}

export function resumeSpeechPlayer() {
  if (!player || !isSpeechSupported()) return;
  if (player.status !== 'paused') return;
  try {
    if (window.speechSynthesis.paused && window.speechSynthesis.speaking) {
      window.speechSynthesis.resume();
      player.status = 'playing';
      emit();
      return;
    }
  } catch {
    /* fall through */
  }
  player.status = 'playing';
  emit();
  speakCurrentSentence();
}

export function stopSpeechPlayer() {
  hardCancelSynth();
  player = null;
  tokenSeq += 1;
  emit();
}

export function speechPrevious() {
  if (!player || !player.sentences.length) return;
  // Restart current sentence, or jump back one if already at start of it (index > 0 and we just restarted once)
  // Simple UX: always go to previous sentence when possible, else restart first
  if (player.index > 0) player.index -= 1;
  player.status = 'playing';
  emit();
  speakCurrentSentence();
}

export function speechRestart() {
  if (!player || !player.sentences.length) return;
  player.index = 0;
  player.status = 'playing';
  emit();
  speakCurrentSentence();
}

export function speechNext() {
  if (!player || !player.sentences.length) return;
  if (player.index < player.sentences.length - 1) {
    player.index += 1;
    player.status = 'playing';
    emit();
    speakCurrentSentence();
  } else {
    stopSpeechPlayer();
  }
}

export function setSpeechPlayerRate(rate) {
  const next = SPEECH_SPEEDS.includes(rate) ? rate : 1;
  setSpeechRatePref(next);
  if (!player || !player.sentences.length) {
    emit();
    return;
  }
  player.rate = next;
  emit();
  if (player.status === 'playing' || player.status === 'paused') {
    player.status = 'playing';
    speakCurrentSentence();
  }
}

export function cycleSpeechPlayerRate() {
  const current = player?.rate ?? getSpeechRatePref();
  const i = SPEECH_SPEEDS.indexOf(current);
  const next = SPEECH_SPEEDS[(i + 1) % SPEECH_SPEEDS.length];
  setSpeechPlayerRate(next);
  return next;
}

export function stopSpeaking() {
  stopSpeechPlayer();
}

export function speakText(raw, { lang, rate, onStart, onEnd, onError, messageIndex } = {}) {
  const beforeId = player?.sessionId || 0;
  const ok = startSpeechPlayer({
    raw,
    lang,
    rate: rate ?? getSpeechRatePref(),
    messageIndex: messageIndex ?? null,
  });
  if (!ok) {
    onError?.(new Error('Speech not supported'));
    return Promise.reject(new Error('Speech not supported'));
  }
  const sessionId = player?.sessionId;
  if (sessionId === beforeId) {
    /* still ok */
  }
  onStart?.();
  return new Promise((resolve) => {
    const unsub = subscribeSpeechPlayer((state) => {
      if (state.sessionId === sessionId && !state.active) {
        unsub();
        onEnd?.();
        resolve();
      }
      if (!state.active && state.sessionId !== sessionId && state.status === 'idle') {
        // stopped / replaced
        unsub();
        onEnd?.();
        resolve();
      }
    });
  });
}
