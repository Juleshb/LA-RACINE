import { CircleHelp, History, Languages, MessageCircle, Sparkles, Volume2, X } from 'lucide-react';

const HOW_ITEMS = [
  { icon: Sparkles, textKey: 'aiTutor.guideHow1' },
  { icon: Languages, textKey: 'aiTutor.guideHow2' },
  { icon: Volume2, textKey: 'aiTutor.guideHow3' },
  { icon: History, textKey: 'aiTutor.guideHow4' },
];

const STEP_KEYS = [
  'aiTutor.guideStep1',
  'aiTutor.guideStep2',
  'aiTutor.guideStep3',
  'aiTutor.guideStep4',
  'aiTutor.guideStep5',
];

const TIP_KEYS = [
  'aiTutor.guideTip1',
  'aiTutor.guideTip2',
  'aiTutor.guideTip3',
];

export default function AiTutorGuide({ open, onClose, t }) {
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="ai-tutor-guide-scrim"
        aria-label={t('ui.close')}
        onClick={onClose}
      />
      <aside className="ai-glass ai-tutor-guide" role="dialog" aria-modal="true" aria-labelledby="ai-tutor-guide-title">
        <div className="ai-tutor-guide-head">
          <div className="ai-tutor-guide-head-icon" aria-hidden>
            <CircleHelp className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="ai-tutor-guide-kicker">{t('aiTutor.guide')}</p>
            <h2 id="ai-tutor-guide-title">{t('aiTutor.guideTitle')}</h2>
          </div>
          <button
            type="button"
            className="ai-glass-icon-btn"
            onClick={onClose}
            aria-label={t('ui.close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="ai-tutor-guide-scroll">
          <p className="ai-tutor-guide-intro">{t('aiTutor.guideIntro')}</p>

          <section className="ai-tutor-guide-section">
            <h3>{t('aiTutor.guideHowTitle')}</h3>
            <ul className="ai-tutor-guide-list">
              {HOW_ITEMS.map(({ icon: Icon, textKey }) => (
                <li key={textKey}>
                  <span className="ai-tutor-guide-list-icon" aria-hidden>
                    <Icon className="w-4 h-4" />
                  </span>
                  <span>{t(textKey)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="ai-tutor-guide-section">
            <h3>{t('aiTutor.guideStepsTitle')}</h3>
            <ol className="ai-tutor-guide-steps">
              {STEP_KEYS.map((key, i) => (
                <li key={key}>
                  <span className="ai-tutor-guide-step-num" aria-hidden>{i + 1}</span>
                  <span>{t(key)}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="ai-tutor-guide-section">
            <h3>{t('aiTutor.guideVoiceTitle')}</h3>
            <ul className="ai-tutor-guide-bullets">
              <li>{t('aiTutor.guideVoice1')}</li>
              <li>{t('aiTutor.guideVoice2')}</li>
              <li>{t('aiTutor.guideVoice3')}</li>
            </ul>
          </section>

          <section className="ai-tutor-guide-section">
            <h3>{t('aiTutor.guideTipsTitle')}</h3>
            <ul className="ai-tutor-guide-bullets">
              {TIP_KEYS.map((key) => (
                <li key={key}>{t(key)}</li>
              ))}
            </ul>
          </section>
        </div>

        <div className="ai-tutor-guide-foot">
          <button type="button" className="ai-glass-btn ai-glass-btn-primary ai-tutor-guide-done" onClick={onClose}>
            <MessageCircle className="w-4 h-4" />
            {t('aiTutor.guideGotIt')}
          </button>
        </div>
      </aside>
    </>
  );
}

export function AiTutorGuideTrigger({ onClick, t, className = '' }) {
  return (
    <button
      type="button"
      className={`ai-glass-btn ${className}`.trim()}
      onClick={onClick}
      title={t('aiTutor.guide')}
      aria-label={t('aiTutor.guide')}
    >
      <CircleHelp className="w-4 h-4" />
      <span className="ai-btn-label">{t('aiTutor.guide')}</span>
    </button>
  );
}
