import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import StudentPageHeader from '../components/student/StudentPageHeader';
import AppIcon from '../components/icons/AppIcon';
import { useTranslation } from '../context/LanguageContext';
import {
  detectSpeechLang,
  isSpeechSupported,
  speakText,
  stopSpeaking,
  warmSpeechVoices,
} from '../lib/speech';
import {
  SCIENCE_LEVELS,
  questionsForLevel,
  quizText,
} from '../data/scienceQuiz';

const VOICE_PREF_KEY = 'laracine_quiz_voice';
let quizAudio;

function readVoicePref() {
  try {
    return localStorage.getItem(VOICE_PREF_KEY) !== '0';
  } catch {
    return true;
  }
}

function unlockQuizAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!quizAudio) quizAudio = new Ctx();
  if (quizAudio.state === 'suspended') quizAudio.resume();
  return quizAudio;
}

function playTone(freq, duration, type = 'sine', volume = 0.16, delay = 0) {
  const ctx = unlockQuizAudio();
  if (!ctx) return;
  const now = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

function playClick() {
  playTone(640, 0.07, 'triangle', 0.12);
}

function playAnswerSound(correct) {
  if (correct) {
    playTone(523, 0.12, 'sine', 0.16);
    playTone(784, 0.16, 'sine', 0.14, 0.09);
    return;
  }
  playTone(196, 0.18, 'sawtooth', 0.08);
}

function playTimeUpChime() {
  playTone(880, 0.22, 'sine', 0.18);
  playTone(659, 0.26, 'sine', 0.16, 0.16);
}

const LEVEL_META = {
  easy: { tone: 'quiz-tile-easy', mark: 'A' },
  medium: { tone: 'quiz-tile-medium', mark: 'B' },
  hard: { tone: 'quiz-tile-hard', mark: 'C' },
  impossible: { tone: 'quiz-tile-challenge', mark: 'D' },
  all: { tone: 'quiz-tile-all', mark: '★' },
};

const ANSWER_MARKS = ['A', 'B', 'C', 'D'];

const TIME_CHOICES = [0, 30, 60, 120];
const CORRECT_PAUSE_MS = 2800;
const WRONG_PAUSE_MS = 3000;

function formatClock(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function questionLimitSeconds(question, secondsEach) {
  const own = Number(question?.minutes);
  if (Number.isFinite(own) && own > 0) return Math.round(own * 60);
  if (secondsEach > 0) return secondsEach;
  return 0;
}

function timeChoiceLabel(seconds, t) {
  if (seconds === 0) return t('scienceQuiz.timeOff');
  if (seconds < 60) return t('scienceQuiz.timeSeconds', { count: seconds });
  if (seconds === 60) return t('scienceQuiz.timeOne');
  return t('scienceQuiz.timeMany', { count: seconds / 60 });
}

function scoreTone(score, total) {
  const ratio = total ? score / total : 0;
  if (ratio >= 0.9) return 'great';
  if (ratio >= 0.7) return 'good';
  if (ratio >= 0.5) return 'ok';
  return 'keep';
}

export default function ScienceQuiz() {
  const { campusId } = useParams();
  const { t, language } = useTranslation();
  const [level, setLevel] = useState(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [secondsEach, setSecondsEach] = useState(30);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [voiceOn, setVoiceOn] = useState(readVoicePref);
  const nextRef = useRef(() => {});
  const advanceRef = useRef(null);
  const answeredRef = useRef(false);
  const voiceOnRef = useRef(voiceOn);
  voiceOnRef.current = voiceOn;
  const speechReady = isSpeechSupported();

  const questions = useMemo(
    () => (level ? questionsForLevel(level) : []),
    [level],
  );
  const question = questions[index];
  const revealed = picked !== null;
  const progress = questions.length ? Math.round(((index + (revealed ? 1 : 0)) / questions.length) * 100) : 0;
  const correctPick = revealed && picked === question?.answer;

  const clearAdvance = () => {
    if (advanceRef.current) {
      clearTimeout(advanceRef.current);
      advanceRef.current = null;
    }
  };

  const start = (nextLevel) => {
    playClick();
    unlockQuizAudio();
    warmSpeechVoices();
    clearAdvance();
    answeredRef.current = false;
    setLevel(nextLevel);
    setIndex(0);
    setPicked(null);
    setScore(0);
    setFinished(false);
  };

  const toggleVoice = () => {
    playClick();
    setVoiceOn((on) => {
      const next = !on;
      try {
        localStorage.setItem(VOICE_PREF_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      if (!next) stopSpeaking();
      return next;
    });
  };

  const speakLine = (text) => {
    if (!voiceOnRef.current || !speechReady || !text) return;
    const line = String(text).replace(/[.!?…]/g, ',').replace(/\s+/g, ' ').trim();
    stopSpeaking();
    window.setTimeout(() => {
      if (!voiceOnRef.current) return;
      speakText(line, { lang: detectSpeechLang(line, language) }).catch(() => {});
    }, 120);
  };

  const choose = (optionIndex) => {
    if (revealed || !question) return;
    const correct = optionIndex === question.answer;
    answeredRef.current = true;
    playAnswerSound(correct);
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
        playTimeUpChime();
        nextRef.current();
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [question?.id, finished, level, limitSeconds]);

  useEffect(() => {
    warmSpeechVoices();
    return () => {
      clearAdvance();
      stopSpeaking();
    };
  }, []);

  useEffect(() => {
    if (!level || finished || !question || !voiceOn) return undefined;
    const prompt = quizText(question.prompt, language);
    const choices = question.options
      .map((option, optionIndex) => `${ANSWER_MARKS[optionIndex]}. ${quizText(option, language)}`)
      .join('. ');
    speakLine(`${prompt}. ${choices}`);
    return undefined;
  }, [question?.id, level, finished, voiceOn, language]);

  useEffect(() => {
    if (!revealed || !question || !voiceOn) return undefined;
    const answer = quizText(question.options[question.answer], language);
    const note = question.note ? quizText(question.note, language) : '';
    const line = correctPick
      ? t('scienceQuiz.congrats')
      : `${t('scienceQuiz.theAnswer', { answer })}. ${note}`.trim();
    speakLine(line);
    return undefined;
  }, [revealed, question?.id, voiceOn, language]);

  useEffect(() => {
    if (!level || finished) stopSpeaking();
  }, [level, finished]);

  return (
    <div className={`student-page quiz-arena quiz-arena-${level || 'pick'}`}>
      <span className="quiz-orb quiz-orb-a" aria-hidden />
      <span className="quiz-orb quiz-orb-b" aria-hidden />
      <span className="quiz-orb quiz-orb-c" aria-hidden />
      <StudentPageHeader
        icon="flask"
        title={t('scienceQuiz.title')}
        subtitle={t('scienceQuiz.subtitle')}
        backTo={level ? undefined : `/campus/${campusId}`}
      />

      {!level && (
        <div className="quiz-pick">
          <div className="quiz-time-bar">
            <p className="quiz-kicker">{t('scienceQuiz.timeEach')}</p>
            <div className="quiz-time-choices">
              {TIME_CHOICES.map((seconds) => (
                <button
                  key={seconds}
                  type="button"
                  onClick={() => {
                    playClick();
                    setSecondsEach(seconds);
                  }}
                  className={`quiz-chip ${secondsEach === seconds ? 'is-on' : ''}`}
                >
                  {timeChoiceLabel(seconds, t)}
                </button>
              ))}
            </div>
            {secondsEach > 0 && (
              <p className="quiz-time-hint">{t('scienceQuiz.timeHint')}</p>
            )}
          </div>
          <div className="quiz-level-grid">
            {SCIENCE_LEVELS.map((key, tileIndex) => (
              <button
                key={key}
                type="button"
                onClick={() => start(key)}
                className={`quiz-tile ${LEVEL_META[key].tone}`}
                style={{ animationDelay: `${tileIndex * 70}ms` }}
              >
                <span className="quiz-tile-mark">{LEVEL_META[key].mark}</span>
                <span className="quiz-tile-copy">
                  <span className="quiz-tile-name">{t(`scienceQuiz.levels.${key}`)}</span>
                  <span className="quiz-tile-hint">{t(`scienceQuiz.hints.${key}`)}</span>
                  <span className="quiz-tile-count">
                    {t('scienceQuiz.questionCount', { count: questionsForLevel(key).length })}
                  </span>
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => start('all')}
              className={`quiz-tile quiz-tile-wide ${LEVEL_META.all.tone}`}
              style={{ animationDelay: '280ms' }}
            >
              <span className="quiz-tile-mark">{LEVEL_META.all.mark}</span>
              <span className="quiz-tile-copy">
                <span className="quiz-tile-name">{t('scienceQuiz.levels.all')}</span>
                <span className="quiz-tile-hint">{t('scienceQuiz.hints.all')}</span>
                <span className="quiz-tile-count">
                  {t('scienceQuiz.questionCount', { count: questionsForLevel('all').length })}
                </span>
              </span>
            </button>
          </div>
        </div>
      )}

      {level && finished && (
        <section className="quiz-score">
          <span className="quiz-confetti" aria-hidden>
            {Array.from({ length: 14 }, (_, piece) => (
              <i key={piece} style={{ '--i': piece }} />
            ))}
          </span>
          <AppIcon name="trophy" className="quiz-trophy" />
          <p className="quiz-score-points">{score}</p>
          <h2 className="quiz-score-title">
            {t('scienceQuiz.scoreTitle', { score, total: questions.length })}
          </h2>
          <p className="quiz-score-note">
            {t(`scienceQuiz.results.${scoreTone(score, questions.length)}`)}
          </p>
          <div className="quiz-score-actions">
            <button type="button" className="quiz-next" onClick={() => start(level)}>
              {t('scienceQuiz.playAgain')}
            </button>
            <button type="button" className="quiz-ghost" onClick={() => { playClick(); setLevel(null); }}>
              {t('scienceQuiz.chooseLevel')}
            </button>
          </div>
        </section>
      )}

      {level && !finished && question && (
        <section key={question.id} className={`quiz-board quiz-board-${question.level}`}>
          <div className="quiz-board-top">
            <span className={`quiz-level-pill quiz-tile-${question.level === 'impossible' ? 'challenge' : question.level}`}>
              {t(`scienceQuiz.levels.${question.level}`)}
            </span>
            <button type="button" className="quiz-ghost" onClick={() => { playClick(); setLevel(null); }}>
              {t('scienceQuiz.chooseLevel')}
            </button>
          </div>
          <div className="quiz-progress" aria-hidden>
            <span style={{ width: `${progress}%` }} />
          </div>
          <div className="quiz-board-meta">
            <p>{t('scienceQuiz.progress', { current: index + 1, total: questions.length })}</p>
            {speechReady && (
              <button
                type="button"
                className={`quiz-ghost ${voiceOn ? 'is-on' : ''}`}
                onClick={toggleVoice}
                aria-pressed={voiceOn}
                title={voiceOn ? t('scienceQuiz.voiceOn') : t('scienceQuiz.voiceOff')}
              >
                <AppIcon name={voiceOn ? 'volume' : 'volumeOff'} className="w-4 h-4" />
                {t('scienceQuiz.voice')}
              </button>
            )}
            {secondsLeft !== null && (
              <p className={`quiz-timer ${secondsLeft <= 10 ? 'is-hot' : ''}`} aria-live="polite">
                {t('scienceQuiz.timeLeft', { time: formatClock(secondsLeft) })}
              </p>
            )}
          </div>
          <h2 className="quiz-prompt">{quizText(question.prompt, language)}</h2>
          <div className="quiz-answers">
            {question.options.map((option, optionIndex) => {
              const isAnswer = optionIndex === question.answer;
              const isPick = optionIndex === picked;
              const state = !revealed
                ? ''
                : isAnswer
                  ? 'is-correct'
                  : isPick
                    ? 'is-wrong'
                    : 'is-dim';
              return (
                <button
                  key={optionIndex}
                  type="button"
                  disabled={revealed}
                  onClick={() => choose(optionIndex)}
                  className={`quiz-answer quiz-answer-${optionIndex} ${state}`}
                  style={{ animationDelay: `${80 + optionIndex * 60}ms` }}
                >
                  <span className="quiz-answer-mark">{ANSWER_MARKS[optionIndex]}</span>
                  <span>{quizText(option, language)}</span>
                </button>
              );
            })}
          </div>
          {revealed && (
            <div className={`quiz-feedback ${correctPick ? 'is-correct' : 'is-wrong'}`}>
              {correctPick && (
                <span className="quiz-confetti quiz-confetti-burst" aria-hidden>
                  {Array.from({ length: 10 }, (_, piece) => (
                    <i key={piece} style={{ '--i': piece }} />
                  ))}
                </span>
              )}
              {correctPick && <span className="quiz-plus">+1</span>}
              <p className="quiz-congrats">
                {correctPick ? t('scienceQuiz.congrats') : t('scienceQuiz.notQuite')}
              </p>
              {!correctPick && (
                <p className="quiz-right-answer">
                  {t('scienceQuiz.theAnswer', {
                    answer: quizText(question.options[question.answer], language),
                  })}
                </p>
              )}
              {question.note && (
                <p className="quiz-note">{quizText(question.note, language)}</p>
              )}
              <button type="button" className="quiz-next" onClick={() => { playClick(); next(); }}>
                {index + 1 >= questions.length ? t('scienceQuiz.seeScore') : t('scienceQuiz.next')}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
