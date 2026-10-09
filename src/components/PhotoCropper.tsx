import { useEffect, useRef, useState, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { useBackButtonClose } from "../utils/backButtonStack";
import type { CropRect } from "../utils/imageCompression";

interface Props {
  /** Foto originale (data URL) da inquadrare. */
  src: string;
  /** Formato del riquadro (larghezza/altezza, es. 16/9). */
  aspect: number;
  onConfirm: (crop: CropRect) => void;
  onCancel: () => void;
}

const MAX_ZOOM = 4;

/**
 * Riquadro per scegliere l'inquadratura di una foto prima di salvarla:
 * si trascina la foto (un dito o il mouse) e si ingrandisce con due dita
 * o con il cursore. La foto copre sempre tutto il riquadro, quindi non
 * restano mai bordi vuoti.
 */
export default function PhotoCropper({ src, aspect, onConfirm, onCancel }: Props) {
  const { t } = useTranslation();
  useBackButtonClose(true, onCancel);

  const frameRef = useRef<HTMLDivElement>(null);
  const [frameW, setFrameW] = useState(0);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  // Centro dell'inquadratura, in pixel dell'originale.
  const [center, setCenter] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ dist: number; zoom: number } | null>(null);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const update = () => setFrameW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const frameH = frameW / aspect;
  // Scala che fa coprire alla foto tutto il riquadro, moltiplicata per lo zoom.
  const baseScale = natural && frameW ? Math.max(frameW / natural.w, frameH / natural.h) : 0;
  const scale = baseScale * zoom;

  function clampCenter(c: { x: number; y: number }, s: number) {
    if (!natural || !s) return c;
    const halfW = frameW / (2 * s);
    const halfH = frameH / (2 * s);
    return {
      x: Math.min(Math.max(c.x, halfW), natural.w - halfW),
      y: Math.min(Math.max(c.y, halfH), natural.h - halfH),
    };
  }

  function applyZoom(z: number) {
    const next = Math.min(Math.max(z, 1), MAX_ZOOM);
    setZoom(next);
    setCenter((c) => clampCenter(c, baseScale * next));
  }

  function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchStart.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom };
    }
  }

  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev || !scale) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size >= 2 && pinchStart.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchStart.current.dist > 0) applyZoom(pinchStart.current.zoom * (dist / pinchStart.current.dist));
      return;
    }

    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    setCenter((c) => clampCenter({ x: c.x - dx / scale, y: c.y - dy / scale }, scale));
  }

  function handlePointerUp(e: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
  }

  function handleConfirm() {
    if (!natural || !scale) return;
    const w = frameW / scale;
    const h = frameH / scale;
    onConfirm({
      x: (center.x - w / 2) / natural.w,
      y: (center.y - h / 2) / natural.h,
      w: w / natural.w,
      h: h / natural.h,
    });
  }

  return (
    <div className="modal-overlay photo-cropper-overlay" role="dialog" aria-modal="true">
      <div className="modal photo-cropper">
        <div className="modal__header">
          <h2>{t("photoCrop.title")}</h2>
          <button type="button" className="modal__close" onClick={onCancel} aria-label={t("common.close")}>
            ×
          </button>
        </div>

        <div className="photo-cropper__body">
          <div
            ref={frameRef}
            className="photo-cropper__frame"
            style={{ aspectRatio: String(aspect) }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <img
              src={src}
              alt=""
              draggable={false}
              onLoad={(e) => {
                const img = e.currentTarget;
                setNatural({ w: img.naturalWidth, h: img.naturalHeight });
                setCenter({ x: img.naturalWidth / 2, y: img.naturalHeight / 2 });
              }}
              style={
                natural && scale
                  ? {
                      width: natural.w * scale,
                      height: natural.h * scale,
                      transform: `translate(${frameW / 2 - center.x * scale}px, ${frameH / 2 - center.y * scale}px)`,
                    }
                  : { visibility: "hidden" }
              }
            />
          </div>

          <p className="obd-hint">{t("photoCrop.hint")}</p>

          <label className="photo-cropper__zoom">
            <span>{t("photoCrop.zoom")}</span>
            <input
              type="range"
              min={1}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              onChange={(e) => applyZoom(Number(e.target.value))}
            />
          </label>
        </div>

        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            {t("common.cancel")}
          </button>
          <button type="button" className="btn btn--primary" onClick={handleConfirm} disabled={!natural}>
            {t("photoCrop.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
