import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Speech from 'expo-speech';
import { Button, Card, Screen } from '@/src/components/ui';
import { useTranslation } from '@/src/context/LanguageContext';
import { useTheme } from '@/src/context/ThemeContext';
import {
  SCIENCE_LEVELS,
  questionsForLevel,
  quizText,
} from '@/src/data/scienceQuiz';
import { spacing } from '@/src/theme';

const LEVELS = [...SCIENCE_LEVELS, 'all'] as const;
const TIME_CHOICES = [0, 30, 60, 120];
const CORRECT_PAUSE_MS = 2800;
const WRONG_PAUSE_MS = 3000;
const ANSWER_MARKS = ['A', 'B', 'C', 'D'];
const SPEECH_LANG: Record<string, string> = {
  en: 'en-US',
  fr: 'fr-FR',
  rw: 'rw-RW',
  sw: 'sw-KE',
};

function formatClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function questionLimitSeconds(question: { minutes?: number } | undefined, secondsEach: number) {
  const own = Number(question?.minutes);
  if (Number.isFinite(own) && own > 0) return Math.round(own * 60);
  if (secondsEach > 0) return secondsEach;
  return 0;
}

function timeChoiceLabel(seconds: number, t: (key: string, vars?: Record<string, string | number>) => string) {
  if (seconds === 0) return t('scienceQuiz.timeOff');
  if (seconds < 60) return t('scienceQuiz.timeSeconds', { count: seconds });
  if (seconds === 60) return t('scienceQuiz.timeOne');
  return t('scienceQuiz.timeMany', { count: seconds / 60 });
}

function scoreTone(score: number, total: number) {
  const ratio = total ? score / total : 0;
  if (ratio >= 0.9) return 'great';
  if (ratio >= 0.7) return 'good';
  if (ratio >= 0.5) return 'ok';
  return 'keep';
}

export default function ScienceQuizScreen() {
  const { t, language } = useTranslation();
  const { colors } = useTheme();
  const [level, setLevel] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [secondsEach, setSecondsEach] = useState(30);
  const advanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [voiceOn, setVoiceOn] = useState(true);
  const nextRef = useRef<() => void>(() => {});
  const answeredRef = useRef(false);
  const timeUpRef = useRef(false);
  const voiceOnRef = useRef(voiceOn);
  voiceOnRef.current = voiceOn;

  const questions = useMemo(
    () => (level ? questionsForLevel(level) : []),
    [level],
  );
  const question = questions[index];
  const revealed = picked !== null;

  const clearAdvance = () => {
    if (advanceRef.current) {
      clearTimeout(advanceRef.current);
      advanceRef.current = null;
    }
  };

  const start = (nextLevel: string) => {
    clearAdvance();
    answeredRef.current = false;
    setLevel(nextLevel);
    setIndex(0);
    setPicked(null);
    setScore(0);
    setFinished(false);
  };

  const choose = (optionIndex: number) => {
    if (revealed || !question) return;
    const correct = optionIndex === question.answer;
    answeredRef.current = true;
    setPicked(optionIndex);
    if (correct) setScore((value) => value + 1);
    clearAdvance();
    advanceRef.current = setTimeout(() => {
      advanceRef.current = null;
      nextRef.current();
    }, correct ? CORRECT_PAUSE_MS : WRONG_PAUSE_MS);
  };

  const next = () => {
    clearAdvance();
    answeredRef.current = false;
    if (index + 1 >= questions.length) {
      setFinished(true);
      return;
    }
    setIndex((value) => value + 1);
    setPicked(null);
  };
  nextRef.current = next;

  const limitSeconds = questionLimitSeconds(question, secondsEach);

  useEffect(() => {
    if (!level || finished || !question || !limitSeconds) {
      setSecondsLeft(null);
      return undefined;
    }
    let movedOn = false;
    const started = Date.now();
    const tick = () => {
      const left = Math.max(0, limitSeconds - Math.floor((Date.now() - started) / 1000));
      setSecondsLeft(left);
      if (left <= 0 && !movedOn) {
        movedOn = true;
        if (answeredRef.current) return;
        clearAdvance();
        timeUpRef.current = true;
        nextRef.current();
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [question?.id, finished, level, limitSeconds]);

  useEffect(() => () => {
    clearAdvance();
    Speech.stop();
  }, []);

  useEffect(() => {
    if (!voiceOn) {
      Speech.stop();
      return;
    }
    const lang = SPEECH_LANG[language] || 'en-US';
    if (!level || finished || !question) {
      if (finished && timeUpRef.current) {
        timeUpRef.current = false;
        Speech.speak(t('scienceQuiz.timeUp'), { language: lang });
      }
      return;
    }
    const prefix = timeUpRef.current ? `${t('scienceQuiz.timeUp')}. ` : '';
    timeUpRef.current = false;
    const prompt = quizText(question.prompt, language);
    const choices = question.options
      .map((option: { en: string }, optionIndex: number) => `${ANSWER_MARKS[optionIndex]}. ${quizText(option, language)}`)
      .join('. ');
    const line = `${prefix}${prompt}. ${choices}`.replace(/[.!?…]/g, ',');
    Speech.stop();
    Speech.speak(line, { language: lang });
  }, [question?.id, level, finished, voiceOn, language]);

  useEffect(() => {
    if (!revealed || !question || !voiceOnRef.current) return undefined;
    const lang = SPEECH_LANG[language] || 'en-US';
    const answer = quizText(question.options[question.answer], language);
    const correctPick = picked === question.answer;
    const note = question.note ? quizText(question.note, language) : '';
    const line = correctPick
      ? t('scienceQuiz.congrats')
      : `${t('scienceQuiz.theAnswer', { answer })}. ${note}`.trim();
    const id = setTimeout(() => {
      Speech.stop();
      Speech.speak(line.replace(/[.!?…]/g, ','), { language: lang });
    }, 120);
    return () => clearTimeout(id);
  }, [revealed, question?.id, language]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.ink }]}>{t('scienceQuiz.title')}</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t('scienceQuiz.subtitle')}</Text>

        {!level && (
          <Card>
            <Text style={[styles.level, { color: colors.brandDark }]}>{t('scienceQuiz.timeEach')}</Text>
            <View style={styles.timeRow}>
              {TIME_CHOICES.map((seconds) => {
                const selected = secondsEach === seconds;
                return (
                  <Pressable
                    key={seconds}
                    onPress={() => setSecondsEach(seconds)}
                    style={[
                      styles.timeChip,
                      {
                        borderColor: selected ? colors.brand : colors.brandBorder,
                        backgroundColor: selected ? colors.brand : colors.surface,
                      },
                    ]}
                  >
                    <Text style={{ color: selected ? '#fff' : colors.text, fontWeight: '800' }}>
                      {timeChoiceLabel(seconds, t)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {secondsEach > 0 ? (
              <Text style={[styles.hint, { color: colors.textMuted }]}>{t('scienceQuiz.timeHint')}</Text>
            ) : null}
          </Card>
        )}

        {!level && LEVELS.map((key) => (
          <Pressable key={key} onPress={() => start(key)}>
            <Card>
              <Text style={[styles.level, { color: colors.brandDark }]}>
                {t(`scienceQuiz.levels.${key}`)}
              </Text>
              <Text style={[styles.hint, { color: colors.text }]}>
                {t(`scienceQuiz.hints.${key}`)}
              </Text>
              <Text style={[styles.count, { color: colors.brand }]}>
                {t('scienceQuiz.questionCount', { count: questionsForLevel(key).length })}
              </Text>
            </Card>
          </Pressable>
        ))}

        {level && finished && (
          <Card style={styles.scoreCard}>
            <Text style={[styles.score, { color: colors.ink }]}>
              {t('scienceQuiz.scoreTitle', { score, total: questions.length })}
            </Text>
            <Text style={[styles.hint, { color: colors.textMuted }]}>
              {t(`scienceQuiz.results.${scoreTone(score, questions.length)}`)}
            </Text>
            <Button title={t('scienceQuiz.playAgain')} onPress={() => start(level)} />
            <Button title={t('scienceQuiz.chooseLevel')} variant="secondary" onPress={() => setLevel(null)} />
          </Card>
        )}

        {level && !finished && question && (
          <Card style={styles.questionCard}>
            <View style={styles.meta}>
              <Text style={[styles.level, { color: colors.brandDark }]}>
                {t(`scienceQuiz.levels.${question.level}`)}
              </Text>
              <Pressable onPress={() => setLevel(null)}>
                <Text style={[styles.count, { color: colors.brand }]}>
                  {t('scienceQuiz.chooseLevel')}
                </Text>
              </Pressable>
            </View>
            <View style={styles.meta}>
              <Text style={[styles.count, { color: colors.brand }]}>
                {t('scienceQuiz.progress', { current: index + 1, total: questions.length })}
              </Text>
              <Pressable onPress={() => setVoiceOn((on) => !on)}>
                <Text style={[styles.count, { color: colors.brand }]}>
                  {t('scienceQuiz.voice')}
                </Text>
              </Pressable>
              {secondsLeft !== null ? (
                <Text style={[styles.clock, { color: secondsLeft <= 10 ? '#e11d48' : colors.brandDark }]}>
                  {t('scienceQuiz.timeLeft', { time: formatClock(secondsLeft) })}
                </Text>
              ) : null}
            </View>
            <Text style={[styles.prompt, { color: colors.ink }]}>
              {quizText(question.prompt, language)}
            </Text>
            {question.options.map((option: { en: string }, optionIndex: number) => {
              const isAnswer = optionIndex === question.answer;
              const isPick = optionIndex === picked;
              const borderColor = !revealed
                ? colors.brandBorder
                : isAnswer
                  ? '#059669'
                  : isPick
                    ? '#e11d48'
                    : colors.brandBorder;
              return (
                <Pressable
                  key={optionIndex}
                  disabled={revealed}
                  onPress={() => choose(optionIndex)}
                  style={[styles.option, { borderColor, backgroundColor: colors.surface }]}
                >
                  <Text style={[styles.optionText, { color: colors.text }]}>
                    {quizText(option, language)}
                  </Text>
                </Pressable>
              );
            })}
            {revealed && (
              <View style={styles.feedback}>
                <Text style={{ color: picked === question.answer ? '#059669' : '#e11d48', fontWeight: '800', fontSize: 22 }}>
                  {picked === question.answer ? t('scienceQuiz.congrats') : t('scienceQuiz.notQuite')}
                </Text>
                {picked !== question.answer ? (
                  <Text style={{ color: '#065f46', fontWeight: '800', fontSize: 16 }}>
                    {t('scienceQuiz.theAnswer', {
                      answer: quizText(question.options[question.answer], language),
                    })}
                  </Text>
                ) : null}
                {question.note ? (
                  <Text style={[styles.hint, { color: colors.textMuted }]}>
                    {quizText(question.note, language)}
                  </Text>
                ) : null}
                <Button
                  title={index + 1 >= questions.length ? t('scienceQuiz.seeScore') : t('scienceQuiz.next')}
                  onPress={next}
                />
              </View>
            )}
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    gap: spacing.sm + 4,
    paddingBottom: spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  level: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  hint: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  count: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '800',
  },
  scoreCard: {
    gap: 12,
  },
  score: {
    fontSize: 24,
    fontWeight: '800',
  },
  questionCard: {
    gap: 10,
  },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  timeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  timeChip: {
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  clock: {
    fontSize: 20,
    fontWeight: '800',
  },
  prompt: {
    fontSize: 20,
    fontWeight: '800',
  },
  option: {
    borderWidth: 2,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '700',
  },
  feedback: {
    gap: 10,
    marginTop: 4,
  },
});
