"use client";
import { useState } from "react";
import { LoaderCircle, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  folderName: string | null;
  busy: string;
  pending: number;
  onFiles: (files: File[]) => void;
  onBrowse: () => void;
  onGenerate: () => void;
};

/** Upload drop zone plus the Generate button for screenshots still waiting for a report. */
export function CaptureSection({
  folderName,
  busy,
  pending,
  onFiles,
  onBrowse,
  onGenerate,
}: Props) {
  const [dragging, setDragging] = useState(false);
  const blocked = !!busy || !folderName;

  return (
    <div className="capture-panel">
      <div
        id="upload"
        className={`upload-zone ${dragging ? "is-dragging" : ""} ${blocked ? "is-busy" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          if (!blocked) setDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node))
            setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!blocked && event.dataTransfer.files.length)
            onFiles(Array.from(event.dataTransfer.files));
        }}
      >
        <span className="upload-icon">
          <Upload size={21} />
        </span>
        <div>
          {folderName ? (
            <p>
              Drop screenshots here or{" "}
              <button type="button" disabled={blocked} onClick={onBrowse}>
                browse files
              </button>
            </p>
          ) : (
            <p>Create a folder first.</p>
          )}
          <span>Images up to 10 MB each</span>
        </div>
      </div>
      <div className="generate-row">
        <p>
          {pending
            ? `${pending} screenshot${pending === 1 ? "" : "s"} waiting for a report · about a minute each`
            : "No screenshots waiting for a report."}
        </p>
        <Button onClick={onGenerate} disabled={!pending || !!busy}>
          {busy ? (
            <LoaderCircle className="motion-safe:animate-spin" size={16} />
          ) : (
            <Sparkles size={16} />
          )}
          Generate report{pending > 1 ? "s" : ""}
        </Button>
      </div>
    </div>
  );
}
