import { useEffect, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Button } from "@/components/ui/button";
import { stripAttachments } from "@/lib/stripAttachments";

interface Props {
  pdf: PDFDocumentProxy;
  pdfUrl: string;
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  /** Render full-width (mobile menu style). */
  block?: boolean;
}

// Renders a "Download without attachments" button, but only if the PDF has
// any embedded files. Strips the attachments on click and triggers a
// browser download.
export function DownloadStrippedButton({
  pdf,
  pdfUrl,
  className,
  variant = "ghost",
  size = "sm",
  block,
}: Props) {
  const [hasAttachments, setHasAttachments] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    pdf.getAttachments().then((atts) => {
      if (cancelled) return;
      setHasAttachments(!!atts && Object.keys(atts).length > 0);
    }).catch(() => { /* tolerate missing /Names entry */ });
    return () => { cancelled = true; };
  }, [pdf]);

  if (!hasAttachments) return null;

  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { blob } = await stripAttachments(pdfUrl);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const base = pdfUrl.split("/").pop()?.split("?")[0] || "slides.pdf";
      const stem = base.replace(/\.pdf$/i, "");
      a.download = `${stem}-no-attachments.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Give the browser a tick before revoking; Safari has been finicky.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to strip PDF");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={block ? "w-full flex flex-col gap-1" : "flex flex-col items-end gap-0.5"}>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={onClick}
        disabled={busy}
        className={(block ? "w-full justify-start " : "") + (className ?? "")}
      >
        {busy ? "Stripping…" : "Download without attachments"}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
