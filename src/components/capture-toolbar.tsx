"use client";
import {
  Camera,
  LoaderCircle,
  PictureInPicture2,
  Sparkles,
  Square,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Props = {
  floating: boolean;
  busy: string;
  pending: number;
  canFloat: boolean;
  onCapture: () => void;
  onGenerate: () => void;
  onFloat: () => void;
  onStop: () => void;
};

/** Live-capture controls: a compact icon strip in the floating window, a labelled bar in the page. */
export function CaptureToolbar({
  floating,
  busy,
  pending,
  canFloat,
  onCapture,
  onGenerate,
  onFloat,
  onStop,
}: Props) {
  if (floating)
    return (
      <div role="toolbar" aria-label="Live capture" className="pip-bar">
        <span className="pip-live" title="Watching your screen">
          <span className="status-dot live-dot" />
          <span className="sr-only">Live</span>
        </span>
        <button
          type="button"
          className="pip-btn"
          onClick={onCapture}
          disabled={!!busy}
          title={busy || "Take screenshot"}
          aria-label={busy || "Take screenshot"}
        >
          {busy ? (
            <LoaderCircle size={18} className="motion-safe:animate-spin" />
          ) : (
            <Camera size={18} />
          )}
        </button>
        <button
          type="button"
          className="pip-btn"
          onClick={onGenerate}
          disabled={!pending || !!busy}
          title={`Generate reports (${pending} new)`}
          aria-label={`Generate reports (${pending} new)`}
        >
          <Sparkles size={18} />
          {pending > 0 && <span className="pip-count">{pending}</span>}
        </button>
        <button
          type="button"
          className="pip-btn pip-stop"
          onClick={onStop}
          title="Stop watching"
          aria-label="Stop watching"
        >
          <Square size={16} />
        </button>
      </div>
    );
  return (
    <div
      role="toolbar"
      aria-label="Live capture"
      className="capture-toolbar no-print"
    >
      <Badge variant="outline" className="gap-2 border-0">
        <span className="status-dot live-dot" />
        LIVE
      </Badge>
      <Button onClick={onCapture} disabled={!!busy}>
        <Camera size={16} />
        Take screenshot
      </Button>
      <Button
        variant="outline"
        onClick={onGenerate}
        disabled={!pending || !!busy}
      >
        <Sparkles size={15} />
        Generate{pending ? ` (${pending})` : ""}
      </Button>
      {canFloat && (
        <Button variant="outline" onClick={onFloat}>
          <PictureInPicture2 size={15} />
          Float over screen
        </Button>
      )}
      <Button variant="ghost" onClick={onStop}>
        <Square size={14} />
        Stop watching
      </Button>
    </div>
  );
}
