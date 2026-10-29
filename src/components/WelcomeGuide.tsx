import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { isRtlLanguage } from "../i18n";
import ActionGridIcon from "./ActionGridIcon";
import CartoonCar from "./CartoonCar";
import { useBackButtonClose } from "../utils/backButtonStack";

interface Props {
  onDone: () => void;
}

const STEPS = [
  { icon: "fuel", key: "fuel" },
  { icon: "bell", key: "deadlines" },
  { icon: "folder", key: "data" },
] as const;

/**
 * Breve guida mostrata una sola volta a chi apre l'app per la prima volta
 * (dopo lingua e avvertenze, finché non c'è ancora nessun veicolo):
 * tre schermate su cosa fa l'app, saltabili in qualunque momento.
 */
export default function WelcomeGuide({ onDone }: Props) {
  const { t, i18n } = useTranslation();
  const [step, setStep] = useState(0);
  const rtl = isRtlLanguage(i18n.language.split("-")[0]);
  const last = step === STEPS.length - 1;
  const current = STEPS[step];
  // Il tasto indietro di Android torna alla schermata precedente, o chiude la guida dalla prima.
  // (il gestore viene registrato una volta sola, quindi legge il passo da un ref)
  const stepRef = useRef(step);
  stepRef.current = step;
  useBackButtonClose(true, () => (stepRef.current > 0 ? setStep(stepRef.current - 1) : onDone()));

  return (
    <div className="welcome-guide" dir={rtl ? "rtl" : "ltr"}>
      <div className="welcome-guide__top">
        {!last && (
          <button type="button" className="welcome-guide__skip" onClick={onDone}>
            {t("welcomeGuide.skip")}
          </button>
        )}
      </div>
      <div className="welcome-guide__body" key={current.key}>
        {step === 0 && (
          <span className="welcome-guide__cars" aria-hidden="true">
            <CartoonCar bodyType="citycar" color="#3fb36b" />
            <CartoonCar bodyType="suv" color="#3b7ddd" />
            <CartoonCar bodyType="hatchback" color="#f5901f" />
          </span>
        )}
        <span className="welcome-guide__icon">
          <ActionGridIcon name={current.icon} />
        </span>
        <h1>{t(`welcomeGuide.${current.key}Title`)}</h1>
        <p>{t(`welcomeGuide.${current.key}Body`)}</p>
      </div>
      <div className="welcome-guide__footer">
        <div className="welcome-guide__dots" aria-hidden="true">
          {STEPS.map((s, i) => (
            <span key={s.key} className={i === step ? "is-active" : ""} />
          ))}
        </div>
        <button
          type="button"
          className="btn btn--primary welcome-guide__next"
          onClick={() => (last ? onDone() : setStep(step + 1))}
        >
          {t(last ? "welcomeGuide.start" : "welcomeGuide.next")}
        </button>
      </div>
    </div>
  );
}
