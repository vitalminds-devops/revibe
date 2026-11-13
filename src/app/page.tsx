"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  ArrowRight,
  Archive,
  ArchiveRestore,
  FolderPlus,
  Monitor,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CaptureSection } from "@/components/capture-section";
import { CaptureToolbar } from "@/components/capture-toolbar";
import { FolderBar } from "@/components/folder-bar";
import { ReportSection } from "@/components/report-section";
import { ScreenshotGrid } from "@/components/screenshot-grid";
import {
  api,
  isPending,
  isReady,
  type Folder,
  type FolderSort,
  type Shot,
} from "@/lib/api";
import { approxTime, estimateSeconds } from "@/lib/estimate";
import { summarizeReports } from "@/lib/report-summary";
import { grabPng, openFloatingWindow } from "@/lib/screen-capture";
import "./report-print.css";

const message = (err: unknown) =>
  err instanceof Error ? err.message : String(err);
const noSubscribe = () => () => {};

export default function Home() {
  const canWatch = useSyncExternalStore(
    noSubscribe,
    () => !!navigator.mediaDevices?.getDisplayMedia,
    () => false,
  );
  const canFloat = useSyncExternalStore(
    noSubscribe,
    () => !!window.documentPictureInPicture,
    () => false,
  );

  const [sort, setSort] = useState<FolderSort>("newest");
  const [folders, setFolders] = useState<Folder[] | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [loadedFor, setLoadedFor] = useState<number | null>(null);
  const [busy, setBusy] = useState("");
  const [view, setView] = useState("items");
  const [showArchived, setShowArchived] = useState(false);
  const [listVersion, setListVersion] = useState(0); // bump to refetch folders
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [pip, setPip] = useState<Window | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const folder = folders?.find((f) => f.id === selectedId) ?? null;
  const loading =
    folders === null || (folder !== null && loadedFor !== folder.id);
  const visibleShots = folder && loadedFor === folder.id ? shots : [];
  const ready = visibleShots.filter(isReady);
  const pending = visibleShots.filter(isPending);
  const summary = summarizeReports(ready);

  useEffect(() => {
    const ctrl = new AbortController();
    api.folders(sort, showArchived).then(
      (list) => {
        if (ctrl.signal.aborted) return;
        setFolders(list);
        setSelectedId((id) =>
          list.some((f) => f.id === id) ? id : (list[0]?.id ?? null),
        );
      },
      (err) => {
        if (ctrl.signal.aborted) return;
        toast.error("Couldn’t load folders", { description: message(err) });
        setFolders([]);
      },
    );
    return () => ctrl.abort();
  }, [sort, showArchived, listVersion]);

  useEffect(() => {
    if (selectedId === null) return;
    const ctrl = new AbortController();
    api.screenshots(selectedId).then(
      (list) => {
        if (ctrl.signal.aborted) return;
        setShots(list);
        setLoadedFor(selectedId);
      },
      (err) => {
        if (ctrl.signal.aborted) return;
        toast.error("Couldn’t load screenshots", { description: message(err) });
        setShots([]);
        setLoadedFor(selectedId);
      },
    );
    return () => ctrl.abort();
  }, [selectedId]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  useEffect(() => {
    if (!stream) pip?.close();
  }, [stream, pip]);

  // Folder counts change after uploads and generation; the server owns them.
  const refreshFolders = () =>
    api.folders(sort, showArchived).then(setFolders, () => {});

  type Outcome = { title: string; description?: string };

  // One toast per action: loading → success or error, updated in place.
  async function run(
    label: string,
    failTitle: string,
    task: (progress: (label: string) => void) => Promise<Outcome>,
  ) {
    const id = toast.loading(label);
    setBusy(label);
    const progress = (next: string) => {
      setBusy(next);
      toast.loading(next, { id });
    };
    try {
      const { title, description } = await task(progress);
      toast.success(title, { id, description });
    } catch (err) {
      toast.error(failTitle, { id, description: message(err) });
    } finally {
      setBusy("");
      void refreshFolders();
    }
  }

  async function saveFolder(
    verb: "created" | "renamed",
    save: () => Promise<Folder>,
  ) {
    try {
      const saved = await save();
      setSelectedId(saved.id);
      // A new folder is never archived: show the main list it belongs to.
      if (verb === "created" && showArchived) setShowArchived(false);
      else setFolders(await api.folders(sort, showArchived));
      toast.success(`Folder “${saved.name}” ${verb}`);
    } catch (err) {
      toast.error(
        verb === "created"
          ? "Couldn’t create folder"
          : "Couldn’t rename folder",
        {
          description: message(err),
        },
      );
      throw err;
    }
  }

  async function archive(target: Folder) {
    try {
      await api.archiveFolder(target.id);
      setListVersion((v) => v + 1);
      toast.success(`Folder “${target.name}” archived`, {
        description: "Find it under Archived at the bottom of the folder list.",
        action: { label: "Undo", onClick: () => void restore(target) },
      });
    } catch (err) {
      toast.error("Couldn’t archive folder", { description: message(err) });
    }
  }

  async function restore(target: Folder) {
    try {
      await api.restoreFolder(target.id);
      setSelectedId(target.id);
      setShowArchived(false);
      setListVersion((v) => v + 1);
      toast.success(`Folder “${target.name}” restored`);
    } catch (err) {
      toast.error("Couldn’t restore folder", { description: message(err) });
    }
  }

  async function removeShot(shot: Shot) {
    const kind = shot.source === "text" ? "text" : "screenshot";
    const what = shot.report ? `this ${kind} and its report` : `this ${kind}`;
    if (!window.confirm(`Delete ${what}? This can’t be undone.`)) return;
    try {
      await api.deleteShot(shot.id);
      setShots((current) => current.filter((s) => s.id !== shot.id));
      toast.success(kind === "text" ? "Text deleted" : "Screenshot deleted");
      void refreshFolders();
    } catch (err) {
      toast.error(`Couldn’t delete ${kind}`, { description: message(err) });
    }
  }

  async function combineShots(parts: Shot[]) {
    const hadReport = parts.some((shot) => shot.report);
    if (
      hadReport &&
      !window.confirm(
        "Some of these already have a report. Combining replaces them with one new report. Continue?",
      )
    )
      return false;
    try {
      const combined = await api.combine(parts.map((shot) => shot.id));
      const merged = new Set(parts.map((shot) => shot.id));
      setShots((current) =>
        current
          .filter((s) => s.id === combined.id || !merged.has(s.id))
          .map((s) => (s.id === combined.id ? combined : s)),
      );
      toast.success(`${parts.length} screenshots combined`, {
        description: "Click Generate to write one report from all of them.",
      });
      void refreshFolders();
      return true;
    } catch (err) {
      toast.error("Couldn’t combine screenshots", {
        description: message(err),
      });
      return false;
    }
  }

  async function exportExcel(target: Folder) {
    try {
      const path = await api.exportExcel(target.id);
      toast.success("Excel file saved", { description: path });
    } catch (err) {
      toast.error("Couldn’t export Excel", { description: message(err) });
    }
  }

  function upload(images: Blob[], source: "upload" | "screen") {
    if (!folder) return;
    const folderId = folder.id;
    const folderName = folder.name;
    const plural = images.length === 1 ? "" : "s";
    return run(
      `Saving screenshot${plural}…`,
      `Couldn’t save screenshot${plural}`,
      async (progress) => {
        for (const [index, image] of images.entries()) {
          if (images.length > 1)
            progress(`Saving screenshot ${index + 1} of ${images.length}…`);
          const shot = await api.upload(folderId, image, source);
          setShots((current) => [shot, ...current]);
        }
        return {
          title: `${images.length} screenshot${plural} saved`,
          description: `In “${folderName}”`,
        };
      },
    );
  }

  async function addText(text: string) {
    if (!folder) return false;
    const { id: folderId, name: folderName } = folder;
    let added = false;
    await run("Saving text…", "Couldn’t save text", async () => {
      const shot = await api.addText(folderId, text);
      setShots((current) => [shot, ...current]);
      added = true;
      return { title: "Text saved", description: `In “${folderName}”` };
    });
    return added;
  }

  function generate() {
    return run(
      "Generating reports…",
      "Report generation stopped",
      async (progress) => {
        let failed = 0;
        const started = Date.now();
        for (const [index, shot] of pending.entries()) {
          // After the first report, estimate from this server's real speed.
          const average = index
            ? (Date.now() - started) / 1000 / index
            : undefined;
          const left = estimateSeconds(pending.slice(index), average);
          progress(
            `Generating report ${index + 1} of ${pending.length}… ${approxTime(left)} left`,
          );
          const updated = await api.generate(shot.id);
          if (updated.error) failed += 1;
          setShots((current) =>
            current.map((s) => (s.id === updated.id ? updated : s)),
          );
        }
        const done = pending.length - failed;
        return {
          title: `${done} report${done === 1 ? "" : "s"} generated`,
          description: failed
            ? `${failed} item${failed === 1 ? "" : "s"} couldn’t be read. See the Items tab.`
            : undefined,
        };
      },
    );
  }

  async function watch() {
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      display
        .getVideoTracks()[0]
        .addEventListener("ended", () => setStream(null));
      setStream(display);
      // Chrome only allows this right after a click; if the share picker took too long, the toolbar's Float button opens it.
      if (window.documentPictureInPicture) floatControls().catch(() => {});
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "NotAllowedError"))
        toast.error("Couldn’t start screen sharing", {
          description: message(err),
        });
    }
  }

  async function floatControls() {
    const win = await openFloatingWindow();
    win.addEventListener("pagehide", () => setPip(null));
    setPip(win);
  }

  function stopWatching() {
    stream?.getTracks().forEach((track) => track.stop());
    setStream(null);
  }

  async function capture() {
    if (!stream) return;
    const blob = await grabPng(stream, videoRef.current);
    if (blob) await upload([blob], "screen");
  }

  const toolbar = (floating: boolean) => (
    <CaptureToolbar
      floating={floating}
      busy={busy}
      pending={pending.length}
      canFloat={canFloat}
      onCapture={capture}
      onGenerate={generate}
      onFloat={() =>
        floatControls().catch((err) =>
          toast.error("Couldn’t open floating controls", {
            description: message(err),
          }),
        )
      }
      onStop={stopWatching}
    />
  );

  const watchPanel = folder && (
    <div className="live-section">
      <div className="live-intro">
        <span className={`live-icon ${stream ? "is-live" : ""}`}>
          <Monitor size={20} />
        </span>
        <div>
          <h3>
            {stream ? `Watching · saving to ${folder.name}` : "Watch a screen"}
          </h3>
          <p>
            {stream
              ? "Use the bar at the bottom to take a screenshot when a report is on screen."
              : "Mirror your phone with scrcpy or Phone Link, then pick that window."}
          </p>
        </div>
      </div>
      {!stream && (
        <Button variant="outline" onClick={watch}>
          <Monitor size={15} />
          Watch screen
          <ArrowRight size={14} />
        </Button>
      )}
      {stream && (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="mt-4 max-h-[60vh] w-full rounded-xl border bg-black object-contain"
        />
      )}
    </div>
  );

  return (
    <div className="workspace">
      <a href="#main" className="skip-link">
        Skip to workspace
      </a>
      <aside className="sidebar no-print">
        <a href="#" className="brand" aria-label="ReVibe home">
          <Logo />
          ReVibe<span className="brand-dot">.</span>
        </a>
        <FolderBar
          folders={folders ?? []}
          selected={folder}
          sort={sort}
          disabled={!!busy}
          archivedView={showArchived}
          onToggleArchived={() => setShowArchived((v) => !v)}
          onArchive={archive}
          onRestore={restore}
          onSort={setSort}
          onSelect={setSelectedId}
          onCreate={(name) =>
            saveFolder("created", () => api.createFolder(name))
          }
          onRename={(id, name) =>
            saveFolder("renamed", () => api.renameFolder(id, name))
          }
        />
      </aside>

      <div className="workspace-body">
        <main id="main" className={`main-content ${stream ? "pb-36" : ""}`}>
          <div className="page-heading no-print">
            <div>
              <h1>{folder?.name ?? "Accomplishment reports"}</h1>
              {folder?.archived && (
                <p className="archived-note">
                  <Archive size={14} />
                  This folder is archived.
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void restore(folder)}
                  >
                    <ArchiveRestore size={14} />
                    Restore
                  </Button>
                </p>
              )}
              <ol className="how-to" aria-label="How it works">
                <li>Add screenshots or paste text</li>
                <li>Generate</li>
                <li>Open the Report tab to export</li>
              </ol>
            </div>
            <input
              ref={inputRef}
              type="file"
              aria-label="Add screenshots"
              accept="image/*"
              multiple
              disabled={!!busy || !folder}
              className="sr-only"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                if (files.length) void upload(files, "upload");
                event.target.value = "";
              }}
            />
          </div>

          {folder ? (
            <>
              <section
                id="capture"
                className="action-card no-print"
                aria-label="Add and generate"
              >
                <CaptureSection
                  folderName={folder.name}
                  busy={busy}
                  pending={pending.length}
                  eta={approxTime(estimateSeconds(pending))}
                  watch={canWatch ? watchPanel : null}
                  onFiles={(files) => void upload(files, "upload")}
                  onBrowse={() => inputRef.current?.click()}
                  onText={addText}
                  onGenerate={generate}
                />
              </section>

              {stream &&
                (pip
                  ? createPortal(toolbar(true), pip.document.body)
                  : toolbar(false))}

              <Tabs value={view} onValueChange={setView} className="results">
                <TabsList aria-label="Results" className="no-print">
                  <TabsTrigger value="items">
                    Items ({visibleShots.length})
                  </TabsTrigger>
                  <TabsTrigger value="report">
                    Report ({ready.length})
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="items">
                  <ScreenshotGrid
                    shots={visibleShots}
                    loading={loading}
                    canAdd={!busy}
                    onAdd={() => inputRef.current?.click()}
                    onDelete={busy ? undefined : removeShot}
                    onCombine={busy ? undefined : combineShots}
                  />
                </TabsContent>
                <TabsContent value="report">
                  <ReportSection
                    folderName={folder.name}
                    onExportExcel={() => void exportExcel(folder)}
                    ready={ready}
                    summary={summary}
                  />
                </TabsContent>
              </Tabs>
            </>
          ) : (
            <div className="start-card no-print">
              {folders === null ? (
                <span className="skeleton inline-block h-5 w-48 rounded" />
              ) : (
                <>
                  <FolderPlus size={22} />
                  <p>
                    {showArchived
                      ? "No archived folders."
                      : "Create a folder in the left panel to start, e.g. “Nov 11 – Team 5”."}
                  </p>
                </>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
