import { useEffect, useRef } from 'react';

function renderSentenceWords(sentence, wordStart, wordEnd, isActive, isPaused) {
  if (!isActive) {
    return <span className="ai-speak-sentence-text">{sentence}</span>;
  }

  const start = Math.max(0, Math.min(wordStart || 0, sentence.length));
  const end = Math.max(start, Math.min(wordEnd || start, sentence.length));
  const before = sentence.slice(0, start);
  const current = sentence.slice(start, end) || sentence.slice(start, start + 1);
  const after = sentence.slice(start + current.length);

  return (
    <span className={`ai-speak-sentence-text is-active ${isPaused ? 'is-paused' : ''}`}>
      {before}
      <mark className="ai-speak-word">{current}</mark>
      {after}
    </span>
  );
}

/**
 * Follow-along transcript while Racine AI is speaking.
 * Highlights the active sentence and the current spoken word.
 */
export default function SpokenTextHighlight({
  sentences = [],
  activeIndex = 0,
  wordStart = 0,
  wordEnd = 0,
  paused = false,
}) {
  const activeRef = useRef(null);

  useEffect(() => {
    const el = activeRef.current;
    if (!el) return;
    const word = el.querySelector('.ai-speak-word');
    const target = word || el;
    target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [activeIndex, wordStart, wordEnd]);

  if (!sentences.length) return null;

  return (
    <div className={`ai-speak-follow ${paused ? 'is-paused' : ''}`} aria-live="polite">
      {sentences.map((sentence, i) => {
        const isActive = i === activeIndex;
        return (
          <p
            key={`${i}-${sentence.slice(0, 12)}`}
            ref={isActive ? activeRef : null}
            className={`ai-speak-sentence ${isActive ? 'is-active' : ''} ${i < activeIndex ? 'is-done' : ''}`}
          >
            {renderSentenceWords(sentence, wordStart, wordEnd, isActive, paused)}
          </p>
        );
      })}
    </div>
  );
}
