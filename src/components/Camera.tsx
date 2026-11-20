import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Icon } from "./Icon.tsx";
import { prepareFromSource, type PreparedImage } from "../lib/image.ts";
import type { Photo } from "../state.ts";

type CamStatus = "starting" | "live" | "denied" | "unsupported";

interface TorchCapabilities extends MediaTrackCapabilities {
  torch?: boolean;
}

export function Camera({
  photos,
  onCapture,
  onDone,
  onClose,
  onPick,
}: {
  photos: Photo[];
  onCapture: (img: PreparedImage) => void;
  onDone: () => void;
  onClose: () => void;
  onPick: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const [status, setStatus] = useState<CamStatus>("starting");
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [flash, setFlash] = useState(0);
  const [ghosts, setGhosts] = useState<{ id: number; src: string }[]>([]);
  const ghostId = useRef(0);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("unsupported");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 2560 }, height: { ideal: 1440 } },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        const track = stream.getVideoTracks()[0];
        trackRef.current = track;
        const caps = (track.getCapabilities?.() ?? {}) as TorchCapabilities;
        setTorchAvailable(Boolean(caps.torch));
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
        setStatus("live");
      } catch (err) {
        if (cancelled) return;
        const name = (err as DOMException)?.name;
        setStatus(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unsupported");
      }
    }
    void start();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
      trackRef.current = null;
    };
  }, []);

  const toggleTorch = useCallback(async () => {
    const track = trackRef.current;
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch {
      setTorchAvailable(false);
    }
  }, [torchOn]);

  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video || status !== "live" || !video.videoWidth) return;
    const img = prepareFromSource(video, video.videoWidth, video.videoHeight);
    onCapture(img);
    setFlash((f) => f + 1);
    const id = ++ghostId.current;
    setGhosts((g) => [...g, { id, src: img.thumb }]);
    window.setTimeout(() => setGhosts((g) => g.filter((x) => x.id !== id)), 700);
    navigator.vibrate?.(20);
  }, [onCapture, status]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        capture();
      } else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [capture, onClose]);

  const count = photos.length;
  const found = photos.reduce((n, p) => n + p.found, 0);

  return (
    <motion.div
      className="camera"
      role="dialog"
      aria-modal="true"
      aria-label="Camera"
      initial={{ opacity: 0, scale: 1.04 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.25 }}
    >
      <video ref={videoRef} className="cam-video" playsInline muted autoPlay />

      {status === "live" && (
        <div className="cam-frame" aria-hidden="true">
          <span className="corner tl" />
          <span className="corner tr" />
          <span className="corner bl" />
          <span className="corner br" />
          <motion.span
            className="cam-hint"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            {count === 0 ? "Zet de kaart scherp in beeld" : "Volgende stuk van de kaart? Klik!"}
          </motion.span>
        </div>
      )}

      {status === "starting" && <div className="cam-msg">Camera starten…</div>}
      {(status === "denied" || status === "unsupported") && (
        <div className="cam-msg cam-msg-box">
          <Icon name="camera" size={36} />
          <h2>{status === "denied" ? "Geen toegang tot je camera" : "Camera niet beschikbaar"}</h2>
          <p>
            {status === "denied"
              ? "Geef de browser toestemming voor de camera, of kies foto's uit je galerij."
              : "Kies foto's uit je galerij of maak ze met je camera-app."}
          </p>
          <button className="btn btn-primary btn-lg" onClick={onPick}>
            <Icon name="images" /> Kies foto's
          </button>
        </div>
      )}

      <AnimatePresence>
        {flash > 0 && (
          <motion.div
            key={flash}
            className="cam-flash"
            initial={{ opacity: 0.85 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          />
        )}
      </AnimatePresence>

      {ghosts.map((g) => (
        <motion.img
          key={g.id}
          src={g.src}
          alt=""
          className="cam-ghost"
          initial={{ x: "-50%", y: "-50%", scale: 1, rotate: 0, opacity: 1 }}
          animate={{ x: "-50%", y: "38vh", scale: 0.2, rotate: -10, opacity: 0.3 }}
          transition={{ duration: 0.55, ease: [0.5, 0, 0.7, 1] }}
        />
      ))}

      <div className="cam-top">
        <button className="icon-btn glass" onClick={onClose} aria-label="Sluiten">
          <Icon name="x" />
        </button>
        <AnimatePresence>
          {count > 0 && (
            <motion.div
              className="cam-counter"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              key="counter"
            >
              <motion.span key={count} initial={{ scale: 1.6 }} animate={{ scale: 1 }} className="cam-count">
                {count}
              </motion.span>
              {count === 1 ? "foto" : "foto's"}
              {found > 0 && <span className="cam-found">· {found} dranken</span>}
            </motion.div>
          )}
        </AnimatePresence>
        {torchAvailable ? (
          <button
            className={`icon-btn glass ${torchOn ? "on" : ""}`}
            onClick={toggleTorch}
            aria-label={torchOn ? "Lamp uit" : "Lamp aan"}
            aria-pressed={torchOn}
          >
            <Icon name="flash" />
          </button>
        ) : (
          <span className="icon-spacer" />
        )}
      </div>

      <div className="cam-bottom">
        <div className="cam-strip">
          <AnimatePresence initial={false}>
            {photos.slice(-6).map((p) => (
              <motion.div
                key={p.id}
                className={`cam-thumb st-${p.status}`}
                layout
                initial={{ scale: 0.2, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.2, opacity: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 26 }}
              >
                <img src={p.thumb} alt="" />
                {p.status === "scanning" && <span className="scanline" />}
                {p.found > 0 && <span className="cam-thumb-n">+{p.found}</span>}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        <div className="cam-controls">
          <button className="icon-btn glass lg" onClick={onPick} aria-label="Kies uit galerij">
            <Icon name="images" size={24} />
          </button>
          <motion.button
            className="shutter"
            onClick={capture}
            disabled={status !== "live"}
            aria-label="Foto nemen"
            whileTap={{ scale: 0.86 }}
          >
            <span className="shutter-inner" />
          </motion.button>
          <motion.button
            className="btn btn-primary cam-done"
            onClick={onDone}
            disabled={count === 0}
            whileTap={{ scale: 0.95 }}
            animate={count > 0 ? { scale: [1, 1.08, 1] } : {}}
            transition={{ duration: 0.35 }}
            key={`done-${count}`}
          >
            Klaar
            <Icon name="arrowRight" size={18} />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
