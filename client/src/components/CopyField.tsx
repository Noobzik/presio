import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex gap-1.5 items-center">
        <code className="flex-1 text-xs bg-muted rounded px-2 py-2.5 overflow-x-auto select-all truncate">
          {value}
        </code>
        <Button
          variant="outline"
          onClick={() => {
            navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
        {/* Only show if the value is a valid url and not a local file */}
        {value.startsWith("http") && !value.startsWith("file://") && (

        <Button
          variant="outline"
          onClick={() => window.open(value, "_blank", "noopener,noreferrer")}
        >
          <ExternalLink size={14} />
        </Button>
        )}
      </div>
    </div>
  );
}
