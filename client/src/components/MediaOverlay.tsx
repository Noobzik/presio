import { useEffect, useRef, useState } from "react";
import { serverNow } from "@/lib/clock";
import type { MediaPlacement } from "@/lib/pdf";

export interface MediaState {
  id: string | null;
  action: "play" | "pause" | "reset";
  seq: number;
}

export interface MediaTimeSync {
  id: string;
  t: number;
  playing: boolean;
  /** Server-clock ms when the controller sampled `t`. Used by the viewer to
   *  compensate for transit + queueing latency. */
  sampledAt: number;
  seq: number;
}

export type AudioTarget = "controller" | "both" | "viewers";

export interface AudioState {
  muted: boolean;
  target: AudioTarget;
  seq: number;
}

// eslint-disable-next-line react-refresh/only-export-components
export const defaultAudioState: AudioState = { muted: true, target: "both", seq: 0 };

// eslint-disable-next-line react-refresh/only-export-components
export function isMutedForRole(role: "controller" | "viewer", audio: AudioState): boolean {
  if (audio.muted) return true;
  if (audio.target === "both") return false;
  if (audio.target === "controller") return role !== "controller";
  return role !== "viewer";
}

interface Props {
  canvasContainerRef: React.RefObject<HTMLDivElement | null>;
  placements: MediaPlacement[];
  mediaState: MediaState;
  /** If true (viewer), gifs run on slide enter; controller stays paused until told. */
  autostart?: boolean;
  /** Controller-only: called periodically with the current video time. The
   *  fourth arg is the server-clock ms when this sample was taken. */
  onTimeSync?: (id: string, t: number, playing: boolean, sampledAt: number) => void;
  /** Viewer-only: latest time-sync message from the controller. */
  timeSync?: MediaTimeSync | null;
  /** Whether videos in this overlay should be muted. */
  muted?: boolean;
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

function computeContainedRect(
  containerW: number,
  containerH: number,
  intrinsicW: number,
  intrinsicH: number
): Rect {
  if (!containerW || !containerH || !intrinsicW || !intrinsicH) {
    return { left: 0, top: 0, width: 0, height: 0 };
  }
  const scale = Math.min(containerW / intrinsicW, containerH / intrinsicH);
  const width = intrinsicW * scale;
  const height = intrinsicH * scale;
  return {
    left: (containerW - width) / 2,
    top: (containerH - height) / 2,
    width,
    height,
  };
}

export function MediaOverlay({
  canvasContainerRef,
  placements,
  mediaState,
  autostart = false,
  onTimeSync,
  timeSync = null,
  muted = true,
}: Props) {
  const [rect, setRect] = useState<Rect>({ left: 0, top: 0, width: 0, height: 0 });

  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const measure = () => {
      const canvas = container.querySelector("canvas");
      if (!canvas) {
        setRect({ left: 0, top: 0, width: 0, height: 0 });
        return;
      }
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      setRect(computeContainedRect(cw, ch, canvas.width, canvas.height));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    // The canvas element is swapped on slide change; watch for child mutations
    const mo = new MutationObserver(measure);
    mo.observe(container, { childList: true });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [canvasContainerRef, placements]);

  if (!placements.length || rect.width === 0) return null;

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      }}
    >
      {placements.map((p) => (
        <MediaItem
          key={p.id}
          placement={p}
          mediaState={mediaState}
          autostart={autostart}
          onTimeSync={onTimeSync}
          timeSync={timeSync && timeSync.id === p.id ? timeSync : null}
          muted={muted}
        />
      ))}
    </div>
  );
}

function MediaItem({
  placement,
  mediaState,
  autostart,
  onTimeSync,
  timeSync,
  muted,
}: {
  placement: MediaPlacement;
  mediaState: MediaState;
  autostart: boolean;
  onTimeSync?: (id: string, t: number, playing: boolean, sampledAt: number) => void;
  timeSync: MediaTimeSync | null;
  muted: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const isVideo = placement.mime.startsWith("video/");
  const targeted = mediaState.id === placement.id;

  // Apply playback state to <video>. On the controller (onTimeSync set), also
  // emit an immediate time-sync so viewers don't wait for the next 1s tick.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (autostart && placement.autoplay && mediaState.id === null) {
      v.currentTime = 0;
      v.play().catch(() => { /* autoplay blocked */ });
      return;
    }
    if (!targeted) return;
    const now = serverNow();
    if (mediaState.action === "play") {
      v.play().catch(() => {});
      onTimeSync?.(placement.id, v.currentTime, true, now);
    } else if (mediaState.action === "pause") {
      v.pause();
      onTimeSync?.(placement.id, v.currentTime, false, now);
    } else if (mediaState.action === "reset") {
      const wasPlaying = !v.paused;
      v.currentTime = 0;
      if (wasPlaying) v.play().catch(() => {});
      onTimeSync?.(placement.id, 0, wasPlaying, now);
    }
  }, [mediaState, targeted, placement.autoplay, placement.id, autostart, onTimeSync]);

  // For GIFs, "reset" by re-assigning src forces playback from frame 0.
  // Use the reset action's seq as the cache-busting nonce so the URL changes
  // on each new reset without needing a setState in an effect.
  const gifNonce =
    !isVideo && targeted && mediaState.action === "reset" ? mediaState.seq : 0;

  // Controller: periodically emit current playback time + sample timestamp.
  // 250ms tick keeps corrections small so we never need a hard re-seek.
  useEffect(() => {
    if (!onTimeSync || !isVideo) return;
    const v = videoRef.current;
    if (!v) return;
    const tick = () => {
      if (v.readyState >= 1) {
        onTimeSync(placement.id, v.currentTime, !v.paused, serverNow());
      }
    };
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [onTimeSync, isVideo, placement.id]);

  // Apply muted state imperatively (React's muted attr is not reliably controlled)
  useEffect(() => {
    const v = videoRef.current;
    if (v) v.muted = muted;
  }, [muted]);

  // Viewer: apply incoming time sync.
  //
  // 1. Latency compensation:
  //      expectedT = sample.t + (serverNow - sample.sampledAt)
  //    — compare against where the controller is *now*.
  // 2. EWMA-smoothed drift kills per-sample jitter (network + browser noise),
  //    so playbackRate doesn't flap on every tick (the main source of the
  //    audio "warble").
  // 3. Rate tuning is audio-aware: when this viewer is muted we can correct
  //    aggressively (±10 % / K=0.4); when unmuted we keep the rate within
  //    ±2 % so it stays inaudible, accepting slower convergence.
  // 4. Hard re-anchor only if drift exceeds HARD (a backstop).
  const driftEwmaRef = useRef<number | null>(null);
  useEffect(() => {
    if (!timeSync || !isVideo) return;
    const v = videoRef.current;
    if (!v) return;

    // Match play/pause state first.
    if (timeSync.playing && v.paused) {
      v.play().catch(() => {});
    } else if (!timeSync.playing && !v.paused) {
      v.pause();
    }

    // Make rate shifts sound like a tape, not a vocoder (less artifacted at
    // small deltas). Setting on every effect is cheap and idempotent.
    type WithPitch = HTMLVideoElement & {
      preservesPitch?: boolean;
      mozPreservesPitch?: boolean;
      webkitPreservesPitch?: boolean;
    };
    const vp = v as WithPitch;
    if (vp.preservesPitch !== undefined) vp.preservesPitch = false;
    else if (vp.mozPreservesPitch !== undefined) vp.mozPreservesPitch = false;
    else if (vp.webkitPreservesPitch !== undefined) vp.webkitPreservesPitch = false;

    const latencyS = Math.max(0, (serverNow() - timeSync.sampledAt) / 1000);
    const expectedT = timeSync.playing ? timeSync.t + latencyS : timeSync.t;
    const rawDrift = v.currentTime - expectedT;

    // EWMA smoothing on drift. Reseed if direction flips by a large step or
    // we've been seeking, so the filter converges quickly on a real change.
    const prev = driftEwmaRef.current;
    const SMOOTHED_RESET = 1.0;
    let smoothed: number;
    if (prev === null || Math.abs(rawDrift - prev) > SMOOTHED_RESET) {
      smoothed = rawDrift;
    } else {
      const ALPHA = 0.3;
      smoothed = prev * (1 - ALPHA) + rawDrift * ALPHA;
    }
    driftEwmaRef.current = smoothed;

    const HARD = 2.0;
    if (Math.abs(smoothed) > HARD) {
      v.playbackRate = 1;
      v.currentTime = Math.max(0, expectedT);
      driftEwmaRef.current = null;
      return;
    }

    // Audio-aware gain.
    const audible = !muted;
    const DEAD = audible ? 0.15 : 0.05;
    const K = audible ? 0.05 : 0.4;
    const RATE_MIN = audible ? 0.98 : 0.9;
    const RATE_MAX = audible ? 1.02 : 1.1;

    // Soft dead-zone: subtract DEAD from |drift| and correct only the excess.
    // Inside DEAD → rate = 1 exactly; at the edge it stays 1 and ramps up
    // smoothly outside, so we always aim at 0 drift (not at the DEAD boundary)
    // without any step at the threshold.
    let rate = 1;
    if (timeSync.playing) {
      const excess = Math.max(0, Math.abs(smoothed) - DEAD);
      const signedExcess = Math.sign(smoothed) * excess;
      rate = Math.max(RATE_MIN, Math.min(RATE_MAX, 1 - K * signedExcess));
    }
    // Snap to 1 if close to avoid lingering imperceptible drift on the rate.
    if (Math.abs(rate - 1) < 0.005) rate = 1;
    if (Math.abs(v.playbackRate - rate) > 0.002) v.playbackRate = rate;
  }, [timeSync, isVideo, muted]);

  // Reset the drift filter whenever play/pause state or target id changes so
  // we don't carry stale samples into a new context.
  useEffect(() => {
    driftEwmaRef.current = null;
  }, [mediaState.id, mediaState.action, mediaState.seq]);

  const style: React.CSSProperties = {
    position: "absolute",
    left: `${placement.xPct * 100}%`,
    top: `${placement.yPct * 100}%`,
    width: `${placement.wPct * 100}%`,
    height: `${placement.hPct * 100}%`,
    objectFit: "cover",
  };

  if (isVideo) {
    return (
      <video
        ref={videoRef}
        src={placement.blobUrl}
        style={style}
        muted
        playsInline
        loop={placement.loop}
      />
    );
  }

  // GIF (or unknown image) — append nonce to URL to force restart on reset
  const src =
    gifNonce > 0 ? `${placement.blobUrl}#n=${gifNonce}` : placement.blobUrl;
  return <img ref={imgRef} src={src} style={style} alt="" />;
}
