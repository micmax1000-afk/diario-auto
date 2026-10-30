import { useTranslation } from "react-i18next";
import { Capacitor } from "@capacitor/core";
import QuickEntryHeader from "./QuickEntryHeader";

interface Props {
  onBack: () => void;
}

/** Modelli che funzionano con l'app su Android (Bluetooth classico). Solo nomi, nessun link. */
const MODELS: { name: string; key: "lx" | "icar" | "veepeak"; tags: ("best" | "balanced" | "high" | "mid" | "cheap")[] }[] = [
  { name: "OBDLink LX Bluetooth", key: "lx", tags: ["best", "high"] },
  { name: "Vgate iCar Pro Bluetooth 3.0", key: "icar", tags: ["balanced", "mid"] },
  { name: "Veepeak Mini Bluetooth", key: "veepeak", tags: ["cheap"] },
];

function Dongle({ accent }: { accent: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M6 9h20l-2.4 11.5a2.6 2.6 0 0 1-2.6 2H11a2.6 2.6 0 0 1-2.6-2z" fill="#2f333a" stroke="#16181c" strokeWidth="1.4" strokeLinejoin="round" />
      <rect x="10" y="4" width="12" height="6" rx="1.6" fill={accent} stroke="#16181c" strokeWidth="1.4" />
      <circle cx="16" cy="15" r="2.2" fill="#9be7ff" />
    </svg>
  );
}

/** Pagina "Adattatori consigliati": cosa cercare, modelli che funzionano, come collegarlo. */
export default function ObdAdapters({ onBack }: Props) {
  const { t } = useTranslation();
  const native = Capacitor.isNativePlatform();
  const accents = ["#f5901f", "#5aa9ff", "#9aa2ad"];

  return (
    <div className="quick-entry-page">
      <QuickEntryHeader title={t("obdAdapters.title")} onBack={onBack} tone="blue" />
      <div className="quick-entry-page__body adapters">
        <p className="adapters__lead">{t("obdAdapters.lead")}</p>

        <h2 className="adapters__sect">{t("obdAdapters.lookFor")}</h2>
        <section className="adapters__check">
          {native ? (
            <>
              <p className="adapters__ok"><i aria-hidden="true">✓</i><span>{t("obdAdapters.okClassic")}</span></p>
              <p className="adapters__ok"><i aria-hidden="true">✓</i><span>{t("obdAdapters.okChip")}</span></p>
              <p className="adapters__no"><i aria-hidden="true">✕</i><span>{t("obdAdapters.noBle")}</span></p>
            </>
          ) : (
            <>
              <p className="adapters__ok"><i aria-hidden="true">✓</i><span>{t("obdAdapters.okBleWeb")}</span></p>
              <p className="adapters__ok"><i aria-hidden="true">✓</i><span>{t("obdAdapters.okChip")}</span></p>
            </>
          )}
          <p className="adapters__no"><i aria-hidden="true">✕</i><span>{t("obdAdapters.noClones")}</span></p>
        </section>

        {native && (
          <>
            <h2 className="adapters__sect">{t("obdAdapters.models")}</h2>
            <div className="adapters__list">
              {MODELS.map((m, i) => (
                <section key={m.key} className="adapters__model">
                  <div className="adapters__top">
                    <span className="adapters__dongle"><Dongle accent={accents[i]} /></span>
                    <div>
                      <h3>{m.name}</h3>
                      <div className="adapters__tags">
                        {m.tags.map((tag) => (
                          <span key={tag} className={`adapters__tag${tag === "best" || tag === "balanced" ? " is-hl" : ""}`}>
                            {t(`obdAdapters.tag.${tag}`)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <p>{t(`obdAdapters.model.${m.key}`)}</p>
                </section>
              ))}
            </div>
          </>
        )}

        <h2 className="adapters__sect">{t("obdAdapters.howTo")}</h2>
        <ol className="adapters__steps">
          <li>{t("obdNotice.nativeStep1")}</li>
          <li>{t("obdNotice.nativeStep2")}</li>
          <li>{t("obdAdapters.step3")}</li>
        </ol>
        <p className="adapters__note">{t("obdAdapters.note")}</p>
      </div>
    </div>
  );
}
