// Lazy loaders for the YouTube IFrame API and Vimeo Player SDK, plus a thin
// uniform interface (play / pause / seek / mute) used by MediaOverlay so the
// controller can drive cross-origin embeds.

// YouTube player state codes (https://developers.google.com/youtube/iframe_api_reference)
export const YT_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

export interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead?: boolean): void;
  mute(): void;
  unMute(): void;
  getCurrentTime(): number;
  getPlayerState(): number;
  destroy(): void;
}

interface YTNamespace {
  Player: new (
    el: HTMLIFrameElement | string,
    opts: {
      events?: {
        onReady?: (e: { target: YTPlayer }) => void;
        onStateChange?: (e: { target: YTPlayer; data: number }) => void;
      };
    }
  ) => YTPlayer;
}

export type VimeoEvent = "play" | "pause" | "timeupdate" | "seeked";
export interface VimeoTimeData {
  seconds: number;
  percent?: number;
  duration?: number;
}

export interface VimeoPlayer {
  ready(): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  getCurrentTime(): Promise<number>;
  getPaused(): Promise<boolean>;
  setCurrentTime(seconds: number): Promise<number>;
  setMuted(muted: boolean): Promise<boolean>;
  on(event: VimeoEvent, fn: (data?: VimeoTimeData) => void): void;
  off(event: VimeoEvent, fn?: (data?: VimeoTimeData) => void): void;
  destroy(): Promise<void>;
}

type VimeoCtor = new (el: HTMLIFrameElement | HTMLElement, opts?: object) => VimeoPlayer;

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
    Vimeo?: { Player: VimeoCtor };
  }
}

let ytPromise: Promise<YTNamespace> | null = null;
export function loadYouTubeApi(): Promise<YTNamespace> {
  if (ytPromise) return ytPromise;
  if (window.YT?.Player) {
    ytPromise = Promise.resolve(window.YT);
    return ytPromise;
  }
  ytPromise = new Promise<YTNamespace>((resolve, reject) => {
    // YT's loader calls a single global; chain any previous handler so we
    // don't clobber a coexisting consumer.
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("YouTube IFrame API loaded without YT.Player"));
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    s.onerror = () => reject(new Error("Failed to load YouTube IFrame API"));
    document.head.appendChild(s);
  });
  return ytPromise;
}

let vimeoPromise: Promise<VimeoCtor> | null = null;
export function loadVimeoApi(): Promise<VimeoCtor> {
  if (vimeoPromise) return vimeoPromise;
  if (window.Vimeo?.Player) {
    vimeoPromise = Promise.resolve(window.Vimeo.Player);
    return vimeoPromise;
  }
  vimeoPromise = new Promise<VimeoCtor>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://player.vimeo.com/api/player.js";
    s.async = true;
    s.onload = () => {
      if (window.Vimeo?.Player) resolve(window.Vimeo.Player);
      else reject(new Error("Vimeo SDK loaded without Vimeo.Player"));
    };
    s.onerror = () => reject(new Error("Failed to load Vimeo Player SDK"));
    document.head.appendChild(s);
  });
  return vimeoPromise;
}
