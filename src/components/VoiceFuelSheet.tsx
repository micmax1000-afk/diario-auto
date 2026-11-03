import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { SpeechRecognition } from "@capacitor-community/speech-recognition";
import { useTranslation } from "react-i18next";
import type { Vehicle } from "../types";
import { useAppSettings } from "../contexts/AppSettingsContext";
import { checkVoiceKm, parseVoiceFuel, voiceScore, type VoiceFuel } from "../utils/voiceFuel";

interface Props {
  vehicles: Vehicle[];
  currentVehicleId: string;
  onContinue: (vehicleId: string, data: VoiceFuel, kind: "fuel" | "charge") => void;
  onClose: () => void;
}

type Recognition = { lang: string; interimResults: boolean; maxAlternatives: number; start: () => void; stop: () => void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };

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
  const [voiceError, setVoiceError] = useState<"unavailable" | "denied" | "nomatch" | null>(null);
  const recRef = useRef<Recognition | null>(null);
  const heard = useRef(false);
  const parsed = parseVoiceFuel(text, vehicles);
  const vehicle = vehicles.find((v) => v.id === (parsed.vehicleId ?? currentVehicleId));
  const current = vehicles.find((v) => v.id === currentVehicleId);
  // Elettrica: sempre ricarica; plug-in: decide la frase; le altre: rifornimento.
  const kindOf = (v?: Vehicle) => (v?.fuelType === "elettrico" ? "charge" : v?.fuelType === "ibrido" ? (parsed.kind ?? "fuel") : "fuel");
  const kind = kindOf(vehicle);
  const charge = kind === "charge";
  const titleKey = current?.fuelType === "elettrico" ? "chargeTitle" : current?.fuelType === "ibrido" ? "bothTitle" : "title";
  const qty = (charge ? parsed.kWh : parsed.liters) ?? (parsed.totalCost && parsed.pricePerUnit ? parsed.totalCost / parsed.pricePerUnit : undefined);
  const ready = !!vehicle && !!parsed.totalCost && !!parsed.pricePerUnit;

  /** Tra le frasi proposte dal riconoscimento sceglie quella da cui si capiscono più dati. */
  function pickBest(matches: string[]): string | undefined {
    let best: string | undefined;
    let bestScore = -1;
    for (const m of matches) {
      const sc = voiceScore(parseVoiceFuel(m, vehicles));
      if (sc > bestScore) {
        best = m;
        bestScore = sc;
      }
    }
    return best;
  }

  async function listenNative() {
    let ready = false;
    try {
      const { available } = await SpeechRecognition.available();
      if (!available) return setVoiceError("unavailable");
      let perm = await SpeechRecognition.checkPermissions();
      if (perm.speechRecognition !== "granted") perm = await SpeechRecognition.requestPermissions();
      if (perm.speechRecognition !== "granted") return setVoiceError("denied");
      setVoiceError(null);
      await SpeechRecognition.removeAllListeners();
      heard.current = false;
      await SpeechRecognition.addListener("partialResults", (d) => {
        const best = pickBest(d.matches ?? []);
        if (best) {
          heard.current = true;
          setText(best);
        }
      });
      await SpeechRecognition.addListener("listeningState", (d) => {
        setListening(d.status === "started");
        if (d.status === "stopped" && !heard.current) setVoiceError("nomatch");
      });
      setListening(true);
      ready = true;
      await SpeechRecognition.start({ language: "it-IT", partialResults: true, popup: false, maxResults: 5 });
    } catch {
      setListening(false);
      // a microfono pronto l'errore vuol dire "non ho sentito/capito", non che manca il riconoscimento
      setVoiceError(ready ? "nomatch" : "unavailable");
    }
  }

  function listen() {
    if (listening) {
      if (Capacitor.isNativePlatform()) void SpeechRecognition.stop();
      else recRef.current?.stop();
      setListening(false);
      return;
    }
    if (Capacitor.isNativePlatform()) {
      void listenNative();
      return;
    }
    const rec = createRecognition();
    if (!rec) return setVoiceError("unavailable");
    recRef.current = rec;
    rec.lang = i18n.language === "it" ? "it-IT" : i18n.language;
    rec.interimResults = true;
    rec.maxAlternatives = 5;
    rec.onresult = (e) =>
      setText(
        Array.from(e.results)
          .map((r) => pickBest(Array.from({ length: (r as ArrayLike<unknown>).length }, (_, i) => r[i].transcript)) ?? "")
          .join(" "),
      );
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    setListening(true);
    rec.start();
  }
  useEffect(
    () => () => {
      recRef.current?.stop();
      if (Capacitor.isNativePlatform()) {
        void SpeechRecognition.stop().catch(() => {});
        void SpeechRecognition.removeAllListeners();
      }
    },
    [],
  );

  // Km detti confrontati con quelli attuali del veicolo
  const [suffixOk, setSuffixOk] = useState<number | null>(null);
  const currentKm = Math.round(vehicle?.currentKm ?? 0);
  const kmCheck = parsed.km !== undefined ? checkVoiceKm(parsed.km, currentKm) : null;
  const nf = (n: number) => n.toLocaleString(i18n.language);
  const usableKm =
    kmCheck?.status === "ok" || kmCheck?.status === "jump"
      ? parsed.km
      : kmCheck?.status === "suffix" && suffixOk === kmCheck.suggestion
        ? kmCheck.suggestion
        : undefined;
  const kmTone = !kmCheck ? "" : kmCheck.status === "lower" ? "bad" : kmCheck.status === "jump" || (kmCheck.status === "suffix" && suffixOk !== kmCheck.suggestion) ? "warn" : "ok";
  const kmValue = !kmCheck
    ? t("voiceFuel.kmSame")
    : kmCheck.status === "suffix"
      ? `${nf(kmCheck.suggestion)}${suffixOk === kmCheck.suggestion ? "" : "?"}`
      : nf(parsed.km!);

  const chip = (label: string, value: string | undefined, ok: boolean | string = !!value) => (
    <div className={`voice-chip${ok === true || ok === "ok" ? " is-ok" : ok === "warn" ? " is-warn" : ok === "bad" ? " is-bad" : ""}`}>
      <span>{label}</span>
      <b>{value ?? "—"}</b>
    </div>
  );

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="voice-title">
      <div className="modal voice-sheet">
        <div className="modal__header">
          <h2 id="voice-title">{t(`voiceFuel.${titleKey}`)}</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label={t("common.close")}>×</button>
        </div>

        <button type="button" className={`voice-mic${listening ? " is-on" : ""}`} onClick={listen} aria-label={t("voiceFuel.speak")}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
          </svg>
        </button>
        <p className="voice-status">{listening ? t("voiceFuel.listening") : t("voiceFuel.tap")}</p>
        {voiceError && <p className="voice-error">{t(voiceError === "denied" ? "voiceFuel.denied" : voiceError === "nomatch" ? "voiceFuel.nomatch" : "voiceFuel.unavailable")}</p>}
        <p className="voice-example">{t(current?.fuelType === "elettrico" ? "voiceFuel.exampleCharge" : "voiceFuel.example")}</p>

        <div className="field">
          <label htmlFor="voice-text">{t("voiceFuel.heard")}</label>
          <input id="voice-text" value={text} onChange={(e) => setText(e.target.value)} placeholder={t("voiceFuel.typeHint")} />
        </div>

        <div className="voice-chips">
          {chip(t("voiceFuel.vehicle"), vehicle?.name, !!parsed.vehicleId)}
          {chip(t("voiceFuel.amount"), parsed.totalCost ? formatMoney(parsed.totalCost) : undefined)}
          {chip(t(charge ? "voiceFuel.priceKwh" : "voiceFuel.price"), parsed.pricePerUnit ? formatMoney(parsed.pricePerUnit, 3) : undefined)}
          {chip(t(charge ? "voiceFuel.energy" : "voiceFuel.liters"), qty ? `${qty.toLocaleString(i18n.language, { maximumFractionDigits: 2 })} ${charge ? "kWh" : "l"}` : undefined)}
          {chip(t("voiceFuel.km"), kmValue, kmTone)}
          {charge
            ? chip(t("voiceFuel.where"), parsed.atHome ? t("voiceFuel.home") : t("voiceFuel.station"), parsed.atHome !== undefined)
            : chip(t("voiceFuel.full"), parsed.fullTank === false ? t("voiceFuel.no") : t("voiceFuel.yes"), parsed.fullTank !== undefined)}
        </div>
        {kmCheck?.status === "suffix" && suffixOk !== kmCheck.suggestion && (
          <div className="voice-km voice-km--warn">
            <span>{t("voiceFuel.kmSuffix", { said: nf(parsed.km!), km: nf(kmCheck.suggestion) })}</span>
            <button type="button" className="btn btn--small btn--primary" onClick={() => setSuffixOk(kmCheck.suggestion)}>
              {t("voiceFuel.kmUse", { km: nf(kmCheck.suggestion) })}
            </button>
          </div>
        )}
        {kmCheck?.status === "lower" && <p className="voice-km voice-km--bad">{t("voiceFuel.kmLower", { said: nf(parsed.km!), km: nf(currentKm) })}</p>}
        {kmCheck?.status === "jump" && <p className="voice-km voice-km--warn">{t("voiceFuel.kmJump", { distance: nf(kmCheck.distance), km: nf(currentKm) })}</p>}
        {!parsed.vehicleId && vehicle && text && <p className="voice-note">{t("voiceFuel.vehicleDefault", { name: vehicle.name })}</p>}

        <div className="modal__actions voice-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>{t("common.cancel")}</button>
          <button type="button" className="btn btn--primary" disabled={!ready} onClick={() => {
              if (!vehicle) return;
              if (listening) void (Capacitor.isNativePlatform() ? SpeechRecognition.stop() : Promise.resolve(recRef.current?.stop()));
              onContinue(vehicle.id, { ...parsed, km: usableKm }, kind);
            }}>
            {t("voiceFuel.continue")}
          </button>
        </div>
      </div>
    </div>
  );
}
