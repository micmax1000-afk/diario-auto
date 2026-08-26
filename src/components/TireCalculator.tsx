import { useState } from "react";
import { useTranslation } from "react-i18next";
import { compareTires, parseTireSizeString, type TireSize } from "../utils/tireCalculator";

interface Props {
  onClose: () => void;
}

const DEFAULT_ORIGINAL: TireSize = { width: 195, aspectRatio: 65, rimDiameter: 15 };
const DEFAULT_ALTERNATIVE: TireSize = { width: 205, aspectRatio: 55, rimDiameter: 16 };

function TireSizeFields({
  label,
  size,
  onChange,
}: {
  label: string;
  size: TireSize;
  onChange: (size: TireSize) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="tire-calc__size-group">
      <span className="tire-calc__size-label">{label}</span>
      <div className="field-row">
        <div className="field">
          <label>{t("tireCalc.width")}</label>
          <input
            type="number"
            inputMode="numeric"
            value={size.width}
            onChange={(e) => onChange({ ...size, width: Number(e.target.value) })}
          />
        </div>
        <div className="field">
          <label>{t("tireCalc.aspectRatio")}</label>
          <input
            type="number"
            inputMode="numeric"
            value={size.aspectRatio}
            onChange={(e) => onChange({ ...size, aspectRatio: Number(e.target.value) })}
          />
        </div>
        <div className="field">
          <label>{t("tireCalc.rimDiameter")}</label>
          <input
            type="number"
            inputMode="numeric"
            value={size.rimDiameter}
            onChange={(e) => onChange({ ...size, rimDiameter: Number(e.target.value) })}
          />
        </div>
      </div>
    </div>
  );
}

export default function TireCalculator({ onClose }: Props) {
  const { t } = useTranslation();
  const [original, setOriginal] = useState<TireSize>(DEFAULT_ORIGINAL);
  const [alternative, setAlternative] = useState<TireSize>(DEFAULT_ALTERNATIVE);
  const [quickInput, setQuickInput] = useState("");

  const result = compareTires(original, alternative);

  const safetyLabel = {
    safe: t("tireCalc.safetySafe"),
    caution: t("tireCalc.safetyCaution"),
    unsafe: t("tireCalc.safetyUnsafe"),
  }[result.safety];

  function handleQuickParse(target: "original" | "alternative") {
    const parsed = parseTireSizeString(quickInput);
    if (!parsed) return;
    if (target === "original") setOriginal(parsed);
    else setAlternative(parsed);
    setQuickInput("");
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="tire-calc-title">
      <div className="modal">
        <div className="modal__header">
          <h2 id="tire-calc-title">{t("tireCalc.title")}</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label={t("common.close")}>
            ×
          </button>
        </div>

        <div style={{ padding: "0 1.5rem 1.5rem" }}>
          <p className="empty-state__body">{t("tireCalc.intro")}</p>

          <div className="field" style={{ marginBottom: "1rem" }}>
            <label>{t("tireCalc.quickInputLabel")}</label>
            <div className="field-row">
              <input
                type="text"
                placeholder={t("tireCalc.quickInputPlaceholder")}
                value={quickInput}
                onChange={(e) => setQuickInput(e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="button" className="btn btn--ghost btn--small" onClick={() => handleQuickParse("original")}>
                {t("tireCalc.useAsOriginal")}
              </button>
              <button type="button" className="btn btn--ghost btn--small" onClick={() => handleQuickParse("alternative")}>
                {t("tireCalc.useAsAlternative")}
              </button>
            </div>
          </div>

          <TireSizeFields label={t("tireCalc.originalTire")} size={original} onChange={setOriginal} />
          <TireSizeFields label={t("tireCalc.alternativeTire")} size={alternative} onChange={setAlternative} />

          <div className={`tire-calc__result tire-calc__result--${result.safety}`}>
            <div className="stat-row">
              <div className="stat-chip">
                <span className="stat-chip__label">{t("tireCalc.originalDiameter")}</span>
                <span className="stat-chip__value">{result.original.overallDiameterMm.toFixed(1)} mm</span>
              </div>
              <div className="stat-chip">
                <span className="stat-chip__label">{t("tireCalc.alternativeDiameter")}</span>
                <span className="stat-chip__value">{result.alternative.overallDiameterMm.toFixed(1)} mm</span>
              </div>
              <div className="stat-chip">
                <span className="stat-chip__label">{t("tireCalc.diameterDiff")}</span>
                <span className="stat-chip__value">
                  {result.diameterDiffPercent > 0 ? "+" : ""}
                  {result.diameterDiffPercent.toFixed(2)}%
                </span>
              </div>
              <div className="stat-chip">
                <span className="stat-chip__label">{t("tireCalc.speedoError")}</span>
                <span className="stat-chip__value">
                  {result.speedometerErrorPercent > 0 ? "+" : ""}
                  {result.speedometerErrorPercent.toFixed(2)}%
                </span>
              </div>
            </div>
            <p className="tire-calc__safety-label">
              {result.safety === "safe" ? "✓ " : "⚠ "}
              {safetyLabel}
            </p>
          </div>

          <p className="obd-hint" style={{ marginTop: "0.75rem" }}>
            {t("tireCalc.disclaimer")}
          </p>
        </div>
      </div>
    </div>
  );
}
