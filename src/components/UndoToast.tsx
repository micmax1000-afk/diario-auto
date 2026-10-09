import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

interface Props {
  onUndo: () => void;
  onDismiss: () => void;
}

const VISIBLE_MS = 6000;

/** Messaggio "Eliminato · Annulla" dopo una cancellazione: sparisce da solo dopo qualche secondo. */
export default function UndoToast({ onUndo, onDismiss }: Props) {
  const { t } = useTranslation();

  // Il timer parte una volta sola: un nuovo messaggio arriva con una nuova key.
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;
  useEffect(() => {
    const timer = window.setTimeout(() => dismissRef.current(), VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="undo-toast" role="status">
      <span>{t("common.deleted")}</span>
      <button type="button" onClick={onUndo}>
        {t("common.undo")}
      </button>
    </div>
  );
}
