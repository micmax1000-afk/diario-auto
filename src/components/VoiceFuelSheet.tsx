import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Vehicle } from "../types";
import { useAppSettings } from "../contexts/AppSettingsContext";
import { parseVoiceFuel, type VoiceFuel } from "../utils/voiceFuel";

interface Props {
  vehicles: Vehicle[];
  currentVehicleId: string;
  onContinue: (vehicleId: string, data: VoiceFuel) => void;
  onClose: () => void;
}

type Recognition = { lang: string; interimResults: boolean; start: () => void; stop: () => void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };

/** Riconoscimento vocale del sistema (gratuito, nessuna API a pagamento). */
function createRecognition(): Recognition | null {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export default function VoiceFuelSheet({ vehicles, currentVehicleId, onContinue, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const { formatMoney } = useAppSettings();
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const recRef = useRef<Recognition | null>(null);
  const parsed = parseVoiceFuel(text, vehicles);
  const vehicle = vehicles.find((v) => v.id === (parsed.vehicleId ?? currentVehicleId));
  const liters = parsed.liters ?? (parsed.totalCost && parsed.pricePerUnit ? parsed.totalCost / parsed.pricePerUnit : undefined);
  const ready = !!vehicle && !!parsed.totalCost && !!parsed.pricePerUnit;

  function listen() {
    const rec = createRecognition();
    if (!rec) return;
    recRef.current = rec;
    rec.lang = i18n.language === "it" ? "it-IT" : i18n.language;
    rec.interimResults = true;
    rec.onresult = (e) => setText(Array.from(e.results).map((r) => r[0].transcript).join(" "));
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    setListening(true);
    rec.start();
  }
  useEffect(() => () => recRef.current?.stop(), []);

  const chip = (label: string, value: string | undefined, ok = !!value) => (
    <div className={`voice-chip${ok ? " is-ok" : ""}`}>
      <span>{label}</span>
      <b>{value ?? "—"}</b>
    </div>
  );

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="voice-title">
      <div className="modal voice-sheet">
        <div className="modal__header">
          <h2 id="voice-title">{t("voiceFuel.title", "Rifornimento a voce")}</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label={t("common.close")}>×</button>
        </div>

        <button type="button" className={`voice-mic${listening ? " is-on" : ""}`} onClick={listen} aria-label={t("voiceFuel.speak", "Parla")}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
          </svg>
        </button>
        <p className="voice-status">{listening ? t("voiceFuel.listening", "Ti ascolto…") : t("voiceFuel.tap", "Tocca il microfono e parla")}</p>
        <p className="voice-example">{t("voiceFuel.example", "Prova: «20 euro sulla Golf a 1,90 al litro, pieno»")}</p>

        <div className="field">
          <label htmlFor="voice-text">{t("voiceFuel.heard", "Ho capito")}</label>
          <input id="voice-text" value={text} onChange={(e) => setText(e.target.value)} placeholder={t("voiceFuel.typeHint", "…oppure scrivi la frase")} />
        </div>

        <div className="voice-chips">
          {chip(t("voiceFuel.vehicle", "Veicolo"), vehicle?.name, !!parsed.vehicleId)}
          {chip(t("voiceFuel.amount", "Importo"), parsed.totalCost ? formatMoney(parsed.totalCost) : undefined)}
          {chip(t("voiceFuel.price", "Prezzo al litro"), parsed.pricePerUnit ? formatMoney(parsed.pricePerUnit, 3) : undefined)}
          {chip(t("voiceFuel.liters", "Litri"), liters ? `${liters.toLocaleString(i18n.language, { maximumFractionDigits: 2 })} l` : undefined)}
          {chip(t("voiceFuel.km", "Km"), parsed.km ? parsed.km.toLocaleString(i18n.language) : t("voiceFuel.kmSame", "invariati"), !!parsed.km)}
          {chip(t("voiceFuel.full", "Pieno"), parsed.fullTank === false ? t("voiceFuel.no", "No") : t("voiceFuel.yes", "Sì"), parsed.fullTank !== undefined)}
        </div>
        {!parsed.vehicleId && vehicle && text && <p className="voice-note">{t("voiceFuel.vehicleDefault", "Veicolo non detto: uso {{name}}.", { name: vehicle.name })}</p>}

        <div className="modal__actions voice-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>{t("common.cancel")}</button>
          <button type="button" className="btn btn--primary" disabled={!ready} onClick={() => vehicle && onContinue(vehicle.id, parsed)}>
            {t("voiceFuel.continue", "Controlla e salva")}
          </button>
        </div>
      </div>
    </div>
  );
}
