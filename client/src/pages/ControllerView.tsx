import { useState, useEffect, useCallback, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { cn, getSessionAuth } from "@/lib/utils";
import { Settings, Check, Option, Plus, Share2, ExternalLink, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DialogOverlay } from "@/components/ui/dialog-overlay";
import { SessionQRCode } from "@/components/SessionQRCode";
import { CopyField } from "@/components/CopyField";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ConnectionIndicator } from "@/components/ConnectionIndicator";
import { LoginDialog } from "@/components/LoginDialog";
import { AccountControl } from "@/components/AccountControl";
import { SyncShareOverlay } from "@/components/SyncShareOverlay";
import { ControllerOnboarding } from "@/components/ControllerOnboarding";
import { hasCompletedControllerOnboarding } from "@/lib/onboarding";
import { useAuth } from "@/lib/useAuth";
import { useClaim } from "@/lib/useClaim";
import { CurrentSlideCard } from "@/components/controller/CurrentSlideCard";
import { NextSlideCard } from "@/components/controller/NextSlideCard";
import { SpeakerNotesCard } from "@/components/controller/SpeakerNotesCard";
import { ThumbnailsCard } from "@/components/controller/ThumbnailsCard";
import { TimerCard, TimerAction, TimerSettingsDialog } from "@/components/controller/TimerCard";
import { ShortcutsEditor } from "@/components/controller/ShortcutsEditor";
import { MobileControllerLayout } from "@/components/controller/MobileControllerLayout";
import { PresioLogo } from "@/components/PresioLogo";
import { useIsMobile } from "@/hooks/useIsMobile";
import {
  DEFAULT_KEYMAP,
  loadKeymap,
  saveKeymap,
  matchesBinding,
  type Keymap,
} from "@/lib/keymap";
import {
  CARD_KEYS,
  CARD_LABELS,
  DEFAULT_LAYOUT,
  loadLayout,
  saveLayout,
  savePreferred,
  hasPreferredLayout,
  loadPreferred,
  addLeaf,
  removeLeaf,
  visibleKeys,
} from "@/lib/controllerLayout";
import { Mosaic, MosaicWindow, type MosaicNode } from "react-mosaic-component";
import "react-mosaic-component/react-mosaic-component.css";
import "./controllerMosaic.css";
import type { PresentationSettings } from "./Presentation";
import type { MediaState, AudioState } from "@/components/MediaOverlay";
import type { MediaPlacement } from "@/lib/pdf";
import { DownloadStrippedButton } from "@/components/DownloadStrippedButton";

// --- Component ---

interface ControllerViewProps {
  id: string;
  local: boolean;
  pdf: PDFDocumentProxy;
  pdfUrl: string;
  currentSlide: number;
  totalSlides: number;
  onGoTo: (slide: number) => void;
  onSyncAll: () => void;
  onEnd: () => void;
  onSynced: () => void;
  currentCanvasRef: React.RefObject<HTMLDivElement | null>;
  settings: PresentationSettings;
  onSettingsChange: (settings: PresentationSettings) => void;
  startedAt: number;
  blanked: boolean;
  onBlankToggle: () => void;
  mediaPlacements: MediaPlacement[];
  /** All slides' media, keyed by slide number — used for thumbnail posters. */
  mediaBySlide: Map<number, MediaPlacement[]>;
  mediaState: MediaState;
  onMediaControl: (id: string, action: "play" | "pause" | "reset") => void;
  onMediaTime: (id: string, t: number, playing: boolean, sampledAt: number) => void;
  muted: boolean;
  audioState: AudioState;
  onAudioChange: (next: { muted: boolean; target: AudioState["target"] }) => void;
}

export function ControllerView({
  id,
  local,
  pdf,
  pdfUrl,
  currentSlide,
  totalSlides,
  onGoTo,
  onSyncAll,
  onEnd,
  onSynced,
  currentCanvasRef,
  settings,
  onSettingsChange,
  startedAt,
  blanked,
  onBlankToggle,
  mediaPlacements,
  mediaBySlide,
  mediaState,
  onMediaControl,
  onMediaTime,
  muted,
  audioState,
  onAudioChange,
}: ControllerViewProps) {
  const isMobile = useIsMobile();
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [timerSettingsOpen, setTimerSettingsOpen] = useState(false);
  const [keymap, setKeymap] = useState<Keymap>(loadKeymap);
  const [viewerBlocked, setViewerBlocked] = useState(false);
  const [viewerPromptOpen, setViewerPromptOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  // First-run tutorial for the controller. Shown before the viewer prompt.
  const [onboardingOpen, setOnboardingOpen] = useState(() => !hasCompletedControllerOnboarding());

  const { user } = useAuth();
  const loggedIn = !!user;
  const { syncing, syncError, sync } = useClaim(id);

  const syncOnline = async () => {
    if (await sync(currentSlide)) onSynced();
  };

  // Rather than auto-opening the viewer (which steals the active tab), prompt
  // the presenter to open it themselves. A real click keeps them on the
  // controller and avoids popup blockers.
  useEffect(() => {
    if (isMobile || onboardingOpen) return;
    // One-time mount prompt (re-armed when onboarding finishes); the single
    // extra render the rule warns about is intentional and harmless here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setViewerPromptOpen(true);
  }, [id, isMobile, onboardingOpen]);

  const [mosaic, setMosaic] = useState<MosaicNode<string> | null>(loadLayout);
  const [hasPreferred, setHasPreferred] = useState(hasPreferredLayout);
  // A card is shown iff it's a leaf in the tree; this drives the Settings checkboxes.
  const visible = new Set(visibleKeys(mosaic));

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (matchesBinding(e, keymap.firstSlide)) {
        e.preventDefault();
        onGoTo(1);
      } else if (matchesBinding(e, keymap.lastSlide)) {
        e.preventDefault();
        onGoTo(totalSlides);
      } else if (matchesBinding(e, keymap.nextSlide)) {
        e.preventDefault();
        onGoTo(currentSlide + 1);
      } else if (matchesBinding(e, keymap.prevSlide)) {
        e.preventDefault();
        onGoTo(currentSlide - 1);
      } else if (matchesBinding(e, keymap.toggleBlank)) {
        onBlankToggle();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentSlide, totalSlides, onGoTo, onBlankToggle, keymap]);

  const onMosaicChange = useCallback((node: MosaicNode<string> | null) => {
    setMosaic(node);
    saveLayout(node);
  }, []);

  const resetLayout = useCallback(() => {
    setMosaic(DEFAULT_LAYOUT);
    saveLayout(DEFAULT_LAYOUT);
  }, []);

  const savePreferredLayout = useCallback(() => {
    savePreferred(mosaic);
    setHasPreferred(true);
  }, [mosaic]);

  const restorePreferredLayout = useCallback(() => {
    const pref = loadPreferred();
    if (!pref) return;
    setMosaic(pref);
    saveLayout(pref);
  }, []);

  const toggleCard = useCallback((key: string) => {
    setMosaic((prev) => {
      const next = visibleKeys(prev).includes(key)
        ? removeLeaf(prev, key)
        : addLeaf(prev, key);
      saveLayout(next);
      return next;
    });
  }, []);

  const controllerUrl = `${window.location.origin}/s/${id}?role=controller`;
  const viewerUrl = `${window.location.origin}/s/${id}?role=viewer`;
  const { passphrase = "" } = getSessionAuth(id);
  const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);

  // Open the viewer in its named window (reused across opens, so no duplicates)
  // and dismiss the prompt. Passing a feature string forces a separate window
  // rather than a tab in the controller's window, so it never steals the active
  // tab here. Tracks whether a popup blocker got in the way.
  const openViewer = () => {
    const features = "popup,width=1280,height=800";
    const w = window.open(viewerUrl, `presio-viewer-${id}`, features);
    setViewerBlocked(!w);
    if (w) setViewerPromptOpen(false);
  };

  // Card content + optional action for each key
  const cardContent: Record<string, { content: ReactNode; action?: ReactNode }> = {
    currentSlide: {
      content: (
        <CurrentSlideCard
          ref={currentCanvasRef}
          local={local}
          mediaPlacements={mediaPlacements}
          mediaState={mediaState}
          onMediaControl={onMediaControl}
          onMediaTime={onMediaTime}
          muted={muted}
          audioState={audioState}
          onAudioChange={onAudioChange}
        />
      ),
    },
    nextSlide: {
      content: <NextSlideCard pdf={pdf} currentSlide={currentSlide} totalSlides={totalSlides} />,
    },
    timer: {
      content: <TimerCard id={id} />,
      action: <TimerAction open={timerSettingsOpen} onToggle={() => setTimerSettingsOpen(!timerSettingsOpen)} />,
    },
    notes: {
      content: <SpeakerNotesCard pdf={pdf} currentSlide={currentSlide} />,
    },
    thumbnails: {
      content: <ThumbnailsCard pdf={pdf} totalSlides={totalSlides} currentSlide={currentSlide} onGoTo={onGoTo} mediaBySlide={mediaBySlide} />,
    },
  };

  if (isMobile) {
    return (
      <MobileControllerLayout
        id={id}
        local={local}
        pdfUrl={pdfUrl}
        pdf={pdf}
        currentSlide={currentSlide}
        totalSlides={totalSlides}
        onGoTo={onGoTo}
        onSyncAll={onSyncAll}
        currentCanvasRef={currentCanvasRef}
        settings={settings}
        startedAt={startedAt}
        passphrase={passphrase}
      />
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col">
      <div className="border-b px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-1.5 text-sm font-semibold hover:text-muted-foreground transition-colors">
            <PresioLogo className="h-4 w-auto" />
            Presio
          </Link>
          <span className="text-muted-foreground/40">|</span>
          {!local && (
            <>
              <span className="text-xs text-muted-foreground">Code:</span>
              <span className="font-mono font-bold tracking-widest select-all">{id}</span>
            </>
          )}
          <ConnectionIndicator local={local} />
          {local && <span className="text-xs font-medium text-amber-600 dark:text-amber-500">Local</span>}
          {blanked && (
            <span className="text-xs font-medium text-destructive px-1.5 py-0.5 rounded bg-destructive/10">
              Blanked
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            title="Settings"
            className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <Settings size={15} />
          </button>
          <ThemeToggle />
          <span className="text-muted-foreground/40">|</span>
          <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={() => setShareDialogOpen(true)}>
            Share
            <Share2 size={12} className="inline ml-1" />
          </Button>
          <span className="text-muted-foreground/40">|</span>
          <button
            type="button"
            onClick={openViewer}
            title={viewerBlocked ? "Viewer window blocked — click to open it" : "Open viewer window"}
            className={`inline-flex items-center gap-1.5 h-8 px-2.5 text-sm font-semibold rounded-md transition-colors ${viewerBlocked
              ? "text-amber-500 bg-amber-500/10 hover:bg-amber-500/20"
              : "text-foreground hover:bg-accent"
              }`}
          >
            <ExternalLink size={15} />
            Open Viewer
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <Mosaic<string>
          className="controller-mosaic"
          value={mosaic}
          onChange={onMosaicChange}
          renderTile={(key, path) => (
            <MosaicWindow<string>
              path={path}
              title={CARD_LABELS[key]}
              renderToolbar={() => (
                <div className="flex items-center justify-between w-full px-3 py-1.5 cursor-move select-none">
                  <span className="text-xs text-muted-foreground font-semibold">{CARD_LABELS[key]}</span>
                  <div className="flex items-center gap-1">
                    {cardContent[key].action}
                    <button
                      type="button"
                      onClick={() => toggleCard(key)}
                      title="Hide card"
                      className="inline-flex items-center justify-center h-5 w-5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              )}
            >
              <div className="h-full flex flex-col p-3 pt-1">
                <div className="flex-1 min-h-0">{cardContent[key].content}</div>
              </div>
            </MosaicWindow>
          )}
          zeroStateView={
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              All cards hidden — enable them in Settings.
            </div>
          }
        />
      </div>

      <div className="border-t p-4 flex items-center justify-center gap-4 shrink-0">
        <Button
          variant="outline"
          onClick={() => onGoTo(currentSlide - 1)}
          disabled={currentSlide <= 1}
        >
          Previous
        </Button>
        <span className="text-sm font-medium tabular-nums">
          {currentSlide} / {totalSlides}
        </span>
        <Button
          variant="outline"
          onClick={() => onGoTo(currentSlide + 1)}
          disabled={currentSlide >= totalSlides}
        >
          Next
        </Button>
        {!local && (
          <Button variant="ghost" size="sm" onClick={onSyncAll} title="Bring all viewers back to the current slide">
            Sync All
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          {pdfUrl && (
            <Button variant="ghost" size="sm" asChild>
              <a href={pdfUrl} download>
                Download PDF
              </a>
            </Button>
          )}
          <DownloadStrippedButton pdf={pdf} pdfUrl={pdfUrl} />
          <Button variant="destructive" size="sm" onClick={() => setConfirmEnd(true)}>
            End Presentation
          </Button>
        </div>
      </div>

      {shareDialogOpen && (
        <DialogOverlay onClose={() => setShareDialogOpen(false)} maxWidth="max-w-[50%]">
          {local ? (
            <>
              <p className="text-sm text-muted-foreground text-center">
                This presentation is local to this browser. Sync it online to let
                viewers join from any device.
              </p>
              <br />
              <br />
              <SyncShareOverlay
                id={id}
                viewerUrl={viewerUrl}
                loggedIn={loggedIn}
                syncing={syncing}
                syncError={syncError}
                onLogin={() => setLoginOpen(true)}
                onSync={syncOnline}
              />
            </>
          ) : (
            <>
              <SessionQRCode sessionId={id} />
              <div className="space-y-2">
                <CopyField label="Viewer link" value={viewerUrl} />
                <CopyField label="Controller link" value={controllerUrl} />
              </div>
            </>
          )}
          <br />
          <br />
          <Button className="w-full" variant="ghost" onClick={() => setShareDialogOpen(false)}>
            Close
          </Button>
        </DialogOverlay>
      )}

      {loginOpen && <LoginDialog onClose={() => setLoginOpen(false)} />}

      {settingsOpen && (
        <DialogOverlay onClose={() => setSettingsOpen(false)} maxWidth="max-w-md">
          <h2 className="text-lg font-semibold">Settings</h2>

          <AccountControl variant="section" />

          <Separator />

          <section className="space-y-2">
            <h3 className="text-sm font-medium">Layout</h3>
            <div className="space-y-0.5">
              {CARD_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleCard(key)}
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded hover:bg-accent transition-colors text-left"
                >
                  <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${visible.has(key) ? "bg-primary border-primary text-primary-foreground" : "border-input"
                    }`}>
                    {visible.has(key) && <Check size={11} strokeWidth={3} />}
                  </span>
                  {CARD_LABELS[key]}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={savePreferredLayout}>
                Save as preferred
              </Button>
              {hasPreferred && (
                <Button size="sm" variant="outline" onClick={restorePreferredLayout}>
                  Restore preferred
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={resetLayout}>
                Reset to default
              </Button>
            </div>
          </section>

          {passphrase && (
            <>
              <Separator />
              <section className="space-y-2">
                <h3 className="text-sm font-medium">Controller Passphrase</h3>
                <p className="text-xs text-muted-foreground">
                  Share this passphrase to grant controller access
                </p>
                <CopyField label="" value={passphrase} />
              </section>
            </>
          )}

          <Separator />

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Keyboard Shortcuts</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setKeymap(DEFAULT_KEYMAP); saveKeymap(DEFAULT_KEYMAP); }}
              >
                Reset defaults
              </Button>
            </div>
            <ShortcutsEditor
              keymap={keymap}
              onChange={(km) => { setKeymap(km); saveKeymap(km); }}
            />
          </section>

          <Button className="w-full" variant="ghost" onClick={() => setSettingsOpen(false)}>
            Close
          </Button>
        </DialogOverlay>
      )}

      {timerSettingsOpen && (
        <TimerSettingsDialog
          settings={settings}
          onSettingsChange={onSettingsChange}
          onClose={() => setTimerSettingsOpen(false)}
        />
      )}

      {confirmEnd && (
        <DialogOverlay onClose={() => setConfirmEnd(false)}>
          <div className="space-y-2 text-center">
            <h2 className="text-lg font-semibold">End Presentation?</h2>
            <p className="text-sm text-muted-foreground">
              {local
                ? "This will close the viewer window and delete the presentation from this browser. This action cannot be undone."
                : "This will disconnect all viewers and permanently delete the presentation. This action cannot be undone."}
            </p>
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" variant="outline" onClick={() => setConfirmEnd(false)}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              variant="destructive"
              onClick={onEnd}
            >
              End Presentation
            </Button>
          </div>
        </DialogOverlay>
      )}

      {viewerPromptOpen && (
        <DialogOverlay onClose={() => setViewerPromptOpen(false)}>
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="text-xs text-muted-foreground">
              Hold <span className="font-medium text-foreground">{isMac ? "⌥ Option" : "Option/Alt"}</span> and click to open it in its own window.
              <br />
              <br />
              Drag the new window to a different screen to present.
            </p>
            <div className="flex items-center gap-2">
              <kbd className="inline-flex items-center justify-center h-9 min-w-9 px-2 rounded-md border border-border bg-muted text-sm font-medium text-muted-foreground shadow-sm">
                {isMac ? <Option size={15} /> : "Option/Alt"}
              </kbd>
              <Plus size={14} className="text-muted-foreground" />
              <button
                type="button"
                onClick={openViewer}
                className={cn(buttonVariants({ variant: "default" }))}
              >
                Open Viewer Window
              </button>
            </div>
            <button
              type="button"
              onClick={() => setViewerPromptOpen(false)}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 mt-2"
            >
              Not now
            </button>
          </div>
        </DialogOverlay>
      )}

      {onboardingOpen && (
        <ControllerOnboarding
          onClose={() => setOnboardingOpen(false)}
          onOpenViewer={openViewer}
        />
      )}
    </div>
  );
}
