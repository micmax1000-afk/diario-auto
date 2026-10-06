import { useState } from "react";
import { useTranslation } from "react-i18next";
import { isRtlLanguage } from "../i18n";

interface Props {
  onSkip: () => void;
  onFinish: () => void;
}

const ICONS = {
  track: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 21V6a1.5 1.5 0 0 1 1.5-1.5h5A1.5 1.5 0 0 1 12 6v15" />
      <path d="M3 21h10M12 10h1.8L17 12.5V18a1.5 1.5 0 0 1-1.5 1.5" />
      <circle cx="18.5" cy="7" r="2.8" />
      <path d="M17.3 7h2.4M18.5 5.8v2.4" />
    </svg>
  ),
  privacy: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 2 4 5v6c0 5.2 3.4 9.8 8 11 4.6-1.2 8-5.8 8-11V5l-8-3z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  add: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-2v-7H6v7H4a1 1 0 0 1-1-1z" />
      <path d="M12 12v5M9.5 14.5h5" />
    </svg>
  ),
};

export default function Onboarding({ onSkip, onFinish }: Props) {
  const { t, i18n } = useTranslation();
  const [step, setStep] = useState(0);
  const rtl = isRtlLanguage(i18n.language);

  const steps = [
    { icon: ICONS.track, title: t("onboarding.step1Title"), body: t("onboarding.step1Body") },
    { icon: ICONS.privacy, title: t("onboarding.step2Title"), body: t("onboarding.step2Body") },
    { icon: ICONS.add, title: t("onboarding.step3Title"), body: t("onboarding.step3Body") },
  ];

  const isLast = step === steps.length - 1;

  function handleNext() {
    if (isLast) {
      onFinish();
    } else {
      setStep((s) => s + 1);
    }
  }

  function handleBack() {
    if (step > 0) setStep((s) => s - 1);
  }

  return (
    <div className="onboarding">
      <button type="button" className="onboarding__skip" onClick={onSkip}>
        {t("onboarding.skip")}
      </button>

      <div className="onboarding__content">
        <div className="onboarding__icon">{steps[step].icon}</div>
        <h1 className="onboarding__title">{steps[step].title}</h1>
        <p className="onboarding__body">{steps[step].body}</p>
      </div>

      <div className="onboarding__footer">
        <div className="onboarding__dots">
          {steps.map((_, i) => (
            <span key={i} className={`onboarding__dot ${i === step ? "is-active" : ""}`} />
          ))}
        </div>

        <div className="onboarding__actions">
          {step > 0 && (
            <button type="button" className="btn btn--ghost" onClick={handleBack}>
              {rtl ? "→" : "←"}
            </button>
          )}
          <button type="button" className="btn btn--primary onboarding__next" onClick={handleNext}>
            {isLast ? t("onboarding.start") : t("onboarding.next")}
          </button>
        </div>
      </div>
    </div>
  );
}
