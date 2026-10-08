import { Router } from 'express';
import { authorizePermission, PERMISSIONS } from '../config/permissions.js';
import {
  checkAiRateLimit,
  completeAiText,
  isAiConfigured,
  normalizeChatMessages,
} from '../lib/studentAi.js';
import {
  guideCatalogForPrompt,
  matchGuide,
  parseGuideReply,
} from '../lib/staffGuideCatalog.js';
import { guideLanguageName, normalizeGuideLanguage, roleLabel } from '../lib/staffGuideI18n.js';

const router = Router();

function systemPrompt(role, language) {
  const lang = normalizeGuideLanguage(language);
  const languageName = guideLanguageName(lang);
  const catalog = guideCatalogForPrompt(role, lang);
  return [
    'You are Ask La Racine AI, the guide inside the École La RACINE school portal.',
    `The signed-in person is a ${roleLabel(role, 'en')}. Answer only as that role.`,
    'Teach them how to do the task in this portal. Use only tasks from the allowed list. Do not invent pages, buttons, fees, marks, or private records.',
    'Write the answer in this order: first a short explanation of the task for this role, then the practical steps. Do not put a link or a URL in the text. The app shows the link after the steps.',
    'If they ask for something that is not in the allowed list, explain that their role does not include that task and name a task they can do.',
    `LANGUAGE RULE: Write the answer only in ${languageName}. The portal language is ${languageName}.`,
    'Understand questions in English, French, Kinyarwanda, and Kiswahili, but the answer must stay in the portal language.',
    'Return JSON only, with no markdown fence:',
    '{"explanation":"what this task is for this role","steps":["first action","second action","third action"],"actions":["action-id"]}',
    'steps must be 3 to 6 short ordered actions. actions must be 1 to 3 ids copied from this allowed list:',
    JSON.stringify(catalog),
  ].join('\n');
}

router.post('/ask', authorizePermission(PERMISSIONS.STAFF_GUIDE), async (req, res) => {
  try {
    const messages = normalizeChatMessages(req.body?.messages);
    const latest = messages[messages.length - 1];
    if (!latest || latest.role !== 'user') {
      return res.status(400).json({ error: 'Ask a question about your work in the portal.' });
    }

    const role = req.user.role;
    const language = normalizeGuideLanguage(req.body?.language);
    const fallback = matchGuide(latest.content, role, language);
    let result = null;

    if (isAiConfigured() && checkAiRateLimit(req.user.id)) {
      try {
        const transcript = messages
          .map((message) => `${message.role === 'assistant' ? 'Guide' : 'Staff'}: ${message.content}`)
          .join('\n');
        const text = await completeAiText({
          system: systemPrompt(role, language),
          prompt: `Portal language: ${guideLanguageName(language)}\n${transcript}`,
        });
        const parsed = parseGuideReply(text, role, language);
        if (parsed) {
          result = {
            explanation: parsed.explanation || fallback.explanation,
            steps: parsed.steps.length ? parsed.steps : fallback.steps,
            actions: parsed.actions.length ? parsed.actions : fallback.actions,
          };
        }
      } catch (error) {
        console.warn('[staff-guide] falling back to portal steps:', error.message);
      }
    }

    res.json(result || fallback);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Ask La Racine AI failed' });
  }
});

export default router;
