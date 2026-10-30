import { useState } from "react";
import { useTranslation } from "react-i18next";

interface Props {
  onContinue: (dontShowAgain: boolean) => void;
  onClose: () => void;
  isNative?: boolean;
  onOpenAdapters?: () => void;
}

export default function ObdRequirementNotice({ onContinue, onClose, isNative = false, onOpenAdapters }: Props) {
  const { t } = useTranslation();
  const [dontShowAgain, setDontShowAgain] = useState(false);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="obd-notice-title">
      <div className="modal modal--small">
        <div className="modal__header">
          <h2 id="obd-notice-title">{t("obdNotice.title")}</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label={t("common.close")}>
            ×
          </button>
        </div>

        <div style={{ padding: "0 1.5rem 1.5rem" }}>
          <p className="obd-notice__safety">{t("obdNotice.safetyWarning")}</p>

          <p className="empty-state__body">{t("obdNotice.intro")}</p>
          <p className="obd-hint">{t("obdNotice.readOnly")}</p>

          {isNative ? (
            <>
              <ol className="obd-notice__steps">
                <li>{t("obdNotice.nativeStep1")}</li>
                <li>{t("obdNotice.nativeStep2")}</li>
                <li>{t("obdNotice.nativeStep3")}</li>
              </ol>
              <p className="obd-notice__note">{t("obdNotice.nativeCompat")}</p>
              <p className="obd-notice__note">{t("obdNotice.notGuaranteed")}</p>
              <p className="obd-hint">{t("obdNotice.nativeFailHint")}</p>
            </>
          ) : (
            <>
              <p className="empty-state__body">{t("obdNotice.webExamplesIntro")}</p>
              <ul className="obd-notice__examples">
                <li>Vgate iCar Pro BLE</li>
                <li>Veepeak OBDCheck BLE</li>
                <li>{t("obdNotice.examplesOther")}</li>
              </ul>
              <p className="obd-hint">{t("obdNotice.bleOnlyHint")}</p>
              <p className="obd-notice__note">{t("obdNotice.notGuaranteed")}</p>
            </>
          )}

          {onOpenAdapters && (
            <button type="button" className="obd-notice__adapters" onClick={onOpenAdapters}>
              {t("obdAdapters.inviteTitle")} ›
            </button>
          )}

          <label className="obd-notice__checkbox">
            <input type="checkbox" checked={dontShowAgain} onChange={(e) => setDontShowAgain(e.target.checked)} />
            {t("obdNotice.dontShowAgain")}
          </label>

          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              {t("fuelForm.cancel")}
            </button>
            <button type="button" className="btn btn--primary" onClick={() => onContinue(dontShowAgain)}>
              {t("obdNotice.continue")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
