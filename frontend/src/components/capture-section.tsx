"use client";
import { useState } from "react";
import {
  ClipboardPaste,
  LoaderCircle,
  Monitor,
  Plus,
  Sparkles,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const MAX_TEXT = 12000;

type Props = {
  folderName: string | null;
  busy: string;
  pending: number;
  /** Live screen capture controls; null when the browser can't share a screen. */
  watch: React.ReactNode;
  onFiles: (files: File[]) => void;
  onBrowse: () => void;
  onText: (text: string) => Promise<boolean>;
  onGenerate: () => void;
};

/** Every way to add a report (upload, paste, watch a screen) plus Generate, in one panel. */
export function CaptureSection({
  folderName,
  busy,
  pending,
  watch,
  onFiles,
  onBrowse,
  onText,
  onGenerate,
}: Props) {
  const [dragging, setDragging] = useState(false);
  const [text, setText] = useState("");
  const blocked = !!busy || !folderName;

  async function addText(event: React.FormEvent) {
    event.preventDefault();
    if (blocked || !text.trim()) return;
    if (await onText(text)) setText("");
  }

  return (
    <div className="capture-panel">
      <Tabs defaultValue="upload">
        <TabsList aria-label="How to add a report" className="add-tabs">
          <TabsTrigger value="upload">
            <Upload size={14} />
            Upload screenshots
          </TabsTrigger>
          <TabsTrigger value="text">
            <ClipboardPaste size={14} />
            Paste text
          </TabsTrigger>
          {watch && (
            <TabsTrigger value="screen">
              <Monitor size={14} />
              Watch screen
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="upload">
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
        </TabsContent>

        <TabsContent value="text">
          <form className="paste-form" onSubmit={addText}>
            <label className="sr-only" htmlFor="report-text">
              Report text
            </label>
            <textarea
              id="report-text"
              rows={6}
              maxLength={MAX_TEXT}
              disabled={blocked}
              placeholder={
                folderName
                  ? "Paste one report here, e.g. the message from the Viber GC.\nTask: 1\nCategory: Repair\nJO Number: …"
                  : "Create a folder first."
              }
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="paste-actions">
              <span>
                One report per entry · skips image reading, so it’s faster
              </span>
              <Button
                type="submit"
                size="sm"
                disabled={blocked || !text.trim()}
              >
                <Plus size={15} />
                Add text
              </Button>
            </div>
          </form>
        </TabsContent>

        {watch && <TabsContent value="screen">{watch}</TabsContent>}
      </Tabs>

      <div className="generate-row">
        <p>
          {pending
            ? `${pending} item${pending === 1 ? "" : "s"} waiting for a report · about a minute each`
            : "Nothing waiting. Add a screenshot or text above, then generate."}
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
