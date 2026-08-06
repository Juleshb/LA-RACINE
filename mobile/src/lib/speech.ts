import * as Speech from 'expo-speech';
import * as SecureStore from 'expo-secure-store';

const AUTO_SPEAK_KEY = 'laracine_ai_auto_speak';
const RATE_KEY = 'laracine_ai_speech_rate';

export const SPEECH_RATES = [0.75, 1, 1.25, 1.5] as const;

export function plainTextForSpeech(raw: string) {
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

export function detectSpeechLang(text: string, appLanguage = 'en') {
  const sample = String(text || '').slice(0, 400);
  if (
    /[àâäéèêëïîôùûüçœæ]/i.test(sample) ||
    /\b(le|la|les|des|une|est|pour|avec|bonjour|merci|comment|pourquoi)\b/i.test(sample)
  ) {
    return 'fr-FR';
  }
  if (/\b(habari|asante|tafadhali|karibu|nina|unaweza|kwa nini|je)\b/i.test(sample)) {
    return 'sw-KE';
  }
  if (/\b(murakoze|amakuru|cyangwa|ndabizi|muraho|ese|ni iki)\b/i.test(sample)) {
    return 'rw-RW';
  }
  const map: Record<string, string> = {
    fr: 'fr-FR',
    rw: 'rw-RW',
    sw: 'sw-KE',
    en: 'en-US',
  };
  return map[appLanguage] || 'en-US';
}

export async function getAutoSpeakPref() {
  try {
    return (await SecureStore.getItemAsync(AUTO_SPEAK_KEY)) === '1';
  } catch {
    return true;
  }
}

export async function setAutoSpeakPref(on: boolean) {
  try {
    await SecureStore.setItemAsync(AUTO_SPEAK_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export async function getSpeechRatePref() {
  try {
    const n = Number(await SecureStore.getItemAsync(RATE_KEY));
    if ((SPEECH_RATES as readonly number[]).includes(n)) return n;
  } catch {
    /* ignore */
  }
  return 1;
}

export async function setSpeechRatePref(rate: number) {
  try {
    await SecureStore.setItemAsync(RATE_KEY, String(rate));
  } catch {
    /* ignore */
  }
}

export async function stopSpeaking() {
  try {
    await Speech.stop();
  } catch {
    /* ignore */
  }
}

export async function isSpeakingNow() {
  try {
    return await Speech.isSpeakingAsync();
  } catch {
    return false;
  }
}

export async function speakText(
  text: string,
  {
    rate = 1,
    language,
    onDone,
    onStopped,
  }: {
    rate?: number;
    language?: string;
    onDone?: () => void;
    onStopped?: () => void;
  } = {},
) {
  const cleaned = plainTextForSpeech(text);
  if (!cleaned) {
    onDone?.();
    return;
  }

  await stopSpeaking();
  const lang = language || detectSpeechLang(cleaned);

  Speech.speak(cleaned, {
    language: lang,
    rate,
    pitch: 1.05,
    onDone: () => onDone?.(),
    onStopped: () => onStopped?.(),
    onError: () => onStopped?.(),
  });
}
