"use client";

import { useEffect, useRef, useState } from "react";
import { FilePlus2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileDropzone, fileRole } from "@/components/upload/FileDropzone";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useBriefStore } from "@/store/briefStore";

/** Adds files to the open brief; everything is re-read and re-checked, reviewer decisions are kept. */
export function AddFilesButton({ className }: { className?: string }) {
  const { view, run, busy } = useBriefStore();
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const dialog = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  if (!view) return null;
  const existing = view.state.files.map((f) => f.name);
  const replacing = files.filter((f) => existing.includes(f.name)).map((f) => f.name);

  const submit = async () => {
    const ok = await run("Adding files and re-checking the brief", (sid) => api.addFiles(sid, files), "Files added · brief re-checked");
    if (ok) {
      setFiles([]);
      setOpen(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded border border-line-strong bg-stock px-3 text-[13px] font-semibold text-ink transition-colors hover:border-ink",
          className
        )}
      >
        <FilePlus2 className="h-4 w-4" /> Add files
      </button>
      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        aria-labelledby="add-files-h"
        className="w-[min(640px,calc(100vw-32px))] rounded border border-line bg-stock p-0 text-ink shadow-lift backdrop:bg-ink/40"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 id="add-files-h" className="text-[18px] font-bold">
              Add files to {view.state.product_name}
            </h2>
            <p className="mt-0.5 text-[13px] text-ink-muted">
              Everything is read again and re-checked. Values you confirmed, answers and items passed to the agency are kept.
            </p>
          </div>
          <button onClick={() => setOpen(false)} className="grid h-8 w-8 shrink-0 place-items-center rounded hover:bg-ink/5" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div>
            <p className="text-[13px] font-semibold">Already in this brief</p>
            <ul className="mt-1 space-y-0.5">
              {view.state.files.map((f) => (
                <li key={f.name} className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="truncate">{f.name}</span>
                  <span className="meta shrink-0 text-ink-muted">{fileRole(f.name).role}</span>
                </li>
              ))}
            </ul>
          </div>
          <FileDropzone
            files={files}
            disabled={!!busy}
            onFilesSelected={(f) => setFiles((prev) => [...prev, ...f.filter((n) => !prev.some((p) => p.name === n.name))])}
            onFileRemoved={(i) => setFiles((prev) => prev.filter((_, k) => k !== i))}
          />
          {replacing.length > 0 && (
            <p className="rounded bg-talker-soft px-3 py-2 text-[13px]">
              Replaces the current {replacing.length === 1 ? "version" : "versions"} of {replacing.join(", ")}.
            </p>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={!files.length || !!busy} onClick={submit}>
            Add and re-check
          </Button>
        </div>
      </dialog>
    </>
  );
}
