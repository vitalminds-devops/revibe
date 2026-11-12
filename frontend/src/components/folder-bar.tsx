"use client";
import { useState } from "react";
import { Check, FolderPlus, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Folder, FolderSort } from "@/lib/api";

type Props = {
  folders: Folder[];
  selected: Folder | null;
  sort: FolderSort;
  disabled: boolean;
  onSort: (sort: FolderSort) => void;
  onSelect: (id: number) => void;
  onCreate: (name: string) => Promise<void>;
  onRename: (id: number, name: string) => Promise<void>;
};

/** Sidebar folder list; the selected folder scopes everything on the page. */
export function FolderBar({
  folders,
  selected,
  sort,
  disabled,
  onSort,
  onSelect,
  onCreate,
  onRename,
}: Props) {
  const [mode, setMode] = useState<"idle" | "create" | "rename">("idle");
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  function open(next: "create" | "rename") {
    setMode(next);
    setDraft(next === "rename" ? (selected?.name ?? "") : "");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const name = draft.trim();
    if (!name || saving) return;
    setSaving(true);
    try {
      if (mode === "rename" && selected) await onRename(selected.id, name);
      else await onCreate(name);
      setMode("idle");
    } catch {
      // The page shows the error; keep the form open so the name can be fixed.
    } finally {
      setSaving(false);
    }
  }

  return (
    <section id="folders" className="folder-panel" aria-label="Folders">
      <div className="folder-panel-head">
        <p className="nav-caption">FOLDERS</p>
        <label className="sr-only" htmlFor="folder-sort">
          Sort folders
        </label>
        <select
          id="folder-sort"
          className="folder-sort"
          value={sort}
          onChange={(e) => onSort(e.target.value as FolderSort)}
        >
          <option value="newest">Newest</option>
          <option value="name">A–Z</option>
        </select>
        <Button
          size="icon"
          variant="outline"
          aria-label="New folder"
          title="New folder"
          onClick={() => open("create")}
          disabled={disabled}
        >
          <FolderPlus size={15} />
        </Button>
      </div>

      {mode !== "idle" && (
        <form className="folder-form" onSubmit={submit}>
          <label className="sr-only" htmlFor="folder-name">
            {mode === "rename" ? "New folder name" : "Folder name"}
          </label>
          <input
            id="folder-name"
            autoFocus
            required
            maxLength={80}
            placeholder="e.g. Nov 11 – Team 5"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setMode("idle")}
          />
          <Button type="submit" size="sm" disabled={!draft.trim() || saving}>
            <Check size={15} />
            {mode === "rename" ? "Save" : "Create"}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Cancel"
            onClick={() => setMode("idle")}
          >
            <X size={15} />
          </Button>
        </form>
      )}

      {folders.length ? (
        <ul className="folder-list">
          {folders.map((folder) => {
            const active = folder.id === selected?.id;
            return (
              <li key={folder.id} className={active ? "is-active" : ""}>
                <button
                  type="button"
                  className="folder-chip"
                  aria-pressed={active}
                  disabled={disabled && !active}
                  onClick={() => onSelect(folder.id)}
                >
                  <span className="folder-name">{folder.name}</span>
                  <span className="folder-meta">
                    {folder.screenshots} item
                    {folder.screenshots === 1 ? "" : "s"}
                    {folder.pending > 0 && ` · ${folder.pending} waiting`}
                  </span>
                </button>
                {active && (
                  <button
                    type="button"
                    className="folder-rename"
                    aria-label={`Rename ${folder.name}`}
                    title="Rename folder"
                    disabled={disabled}
                    onClick={() => open("rename")}
                  >
                    <Pencil size={13} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        mode === "idle" && (
          <p className="folder-empty">
            No folders yet. Click + to create one, e.g. “Nov 11 – Team 5”.
          </p>
        )
      )}
    </section>
  );
}
