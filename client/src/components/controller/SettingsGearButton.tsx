import { Settings } from "lucide-react";

export function SettingsGearButton({
  open,
  onToggle,
  title,
}: {
  open: boolean;
  onToggle: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`text-muted-foreground hover:text-foreground transition-colors ${open ? "text-foreground" : ""}`}
      title={title}
    >
      <Settings size={14} />
    </button>
  );
}
