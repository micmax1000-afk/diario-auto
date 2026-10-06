import { useState } from "react";
import { useTranslation } from "react-i18next";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { isRtlLanguage } from "../i18n";

interface Props {
  onAccept: () => void;
}

/**
 * Avvertenze e limitazione di responsabilità: da accettare una volta al primo
 * avvio (e di nuovo se il testo cambia versione). Senza accettazione l'app
 * non si apre; "Non accetto" chiude l'app su Android.
 */
export default function DisclaimerGate({ onAccept }: Props) {
  const { t, i18n } = useTranslation();
  const [checked, setChecked] = useState(false);
  const [declined, setDeclined] = useState(false);
  const points = t("disclaimer.points", { returnObjects: true }) as unknown as string[];
  const rtl = isRtlLanguage(i18n.language.split("-")[0]);

  function handleDecline() {
    if (Capacitor.isNativePlatform()) {
      CapacitorApp.exitApp();
    } else {
      setDeclined(true);
    }
  }

  return (
    <div className="disclaimer" dir={rtl ? "rtl" : "ltr"}>
      <div className="disclaimer__body">
        <h1>{t("disclaimer.title")}</h1>
        <p className="disclaimer__intro">{t("disclaimer.intro")}</p>
        <ol className="disclaimer__list">
          {Array.isArray(points) && points.map((p, i) => <li key={i}>{p}</li>)}
        </ol>
        <label className="disclaimer__check">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <span>{t("disclaimer.check")}</span>
        </label>
        {declined && <p className="form-error">{t("disclaimer.declineNote")}</p>}
      </div>
      <div className="disclaimer__footer">
        <button type="button" className="btn btn--primary disclaimer__accept" disabled={!checked} onClick={onAccept}>
          {t("disclaimer.accept")}
        </button>
        <button type="button" className="btn btn--ghost disclaimer__decline" onClick={handleDecline}>
          {t("disclaimer.decline")}
        </button>
      </div>
    </div>
  );
}
