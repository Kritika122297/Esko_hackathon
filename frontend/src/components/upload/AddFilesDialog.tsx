"use client";

import { useEffect, useRef, useState } from "react";
import { FilePlus2, Lock, LockOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileDropzone, fileRole } from "@/components/upload/FileDropzone";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useBriefStore } from "@/store/briefStore";

/** Adds files to the open brief; everything is re-read and re-checked, reviewer decisions are kept. */
export function AddFilesButton({ className }: { className?: string }) {
  const { view, run, busy, error, errorStatus, clearError } = useBriefStore();
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [failed, setFailed] = useState(false);
  const dialog = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  if (!view) return null;
  const finalized = view.state.status === "finalized";
  const existing = view.state.files.map((f) => f.name);
  const replacing = files.filter((f) => existing.includes(f.name)).map((f) => f.name);
  // The page's error banner sits behind the modal, so a failed upload is also explained here.
  const problem = failed && error ? (errorStatus === 409 ? "This brief is finalized, so files cannot be added. Reopen it for edits first." : error) : null;

  const close = () => {
    setOpen(false);
    if (failed) {
      setFailed(false);
      clearError();
    }
  };
  const submit = async () => {
    setFailed(false);
    const ok = await run("Adding files and re-checking the brief", (sid) => api.addFiles(sid, files), "Files added · brief re-checked");
    if (ok) {
      setFiles([]);
      setOpen(false);
    } else if (useBriefStore.getState().error) setFailed(true);
  };
  const reopen = async () => {
    setFailed(false);
    const ok = await run("Reopening", (sid) => api.reopen(sid), "Brief reopened");
    if (!ok && useBriefStore.getState().error) setFailed(true);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        title={finalized ? "Finalized briefs take no new files. Reopen the brief for edits first." : undefined}
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded border bg-stock px-3 text-[13px] font-semibold transition-colors",
          finalized ? "border-line text-ink-muted hover:border-line-strong" : "border-line-strong text-ink hover:border-ink",
          className
        )}
      >
        {finalized ? <Lock className="h-4 w-4" /> : <FilePlus2 className="h-4 w-4" />} Add files
        {finalized && <span className="sr-only"> (locked while the brief is finalized)</span>}
      </button>
      <dialog
        ref={dialog}
        onClose={close}
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
          <button onClick={close} className="grid h-8 w-8 shrink-0 place-items-center rounded hover:bg-ink/5" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">
          {problem && (
            <p role="alert" className="rounded border border-stop/40 bg-stop-soft px-3 py-2 text-[13px] text-ink">
              <b className="font-semibold">Files were not added.</b> {problem}
            </p>
          )}
          {finalized && (
            <div className="flex items-start gap-3 rounded border border-line bg-ground px-3 py-2.5 text-[13px]">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
              <p className="text-ink">
                <b className="font-semibold">This brief is finalized.</b> Files cannot be added to a finalized brief. Reopen it for edits, add
                the files, then finalize again.
              </p>
            </div>
          )}
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
          {!finalized && (
            <FileDropzone
              files={files}
              disabled={!!busy}
              onFilesSelected={(f) => setFiles((prev) => [...prev, ...f.filter((n) => !prev.some((p) => p.name === n.name))])}
              onFileRemoved={(i) => setFiles((prev) => prev.filter((_, k) => k !== i))}
            />
          )}
          {!finalized && replacing.length > 0 && (
            <p className="rounded bg-talker-soft px-3 py-2 text-[13px]">
              Replaces the current {replacing.length === 1 ? "version" : "versions"} of {replacing.join(", ")}.
            </p>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          {finalized ? (
            <Button disabled={!!busy} onClick={reopen}>
              <LockOpen className="h-4 w-4" /> Reopen for edits
            </Button>
          ) : (
            <Button disabled={!files.length || !!busy} onClick={submit}>
              Add and re-check
            </Button>
          )}
        </div>
      </dialog>
    </>
  );
}
