"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { FileImage, FileSpreadsheet, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileDropzoneProps {
  files: File[];
  onFilesSelected: (files: File[]) => void;
  onFileRemoved: (index: number) => void;
  disabled?: boolean;
  /** A quieter zone for dialogs. */
  compact?: boolean;
}

const ACCEPT = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "text/plain": [".txt", ".md"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
};

const MAX_MB = 50;

/** The role PackProofAI gives each file, from its type (matches the backend readers). */
export function fileRole(name: string): { role: string; icon: typeof FileText } {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return { role: "Packaging artwork", icon: FileText };
  if (ext === "xlsx") return { role: "Content sheet", icon: FileSpreadsheet };
  if (ext === "docx") return { role: "Brief document", icon: FileText };
  if (ext === "txt" || ext === "md") return { role: "Notes", icon: FileText };
  return { role: "Image (no text layer)", icon: FileImage };
}

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const TILE: Record<string, string> = {
  pdf: "bg-pink-soft text-pink-deep",
  xlsx: "bg-mint-soft text-mint-deep",
  docx: "bg-sky-soft text-sky-deep",
  txt: "bg-desk text-ink-2",
  md: "bg-desk text-ink-2",
};

/** A file's face in the list: a thumbnail for images, a typed tile for documents. */
function FileTile({ file }: { file: File }) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const isImage = file.type.startsWith("image/");
  const url = useMemo(() => (isImage ? URL.createObjectURL(file) : null), [file, isImage]);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="h-11 w-11 shrink-0 rounded-md border border-line object-cover" />;
  }
  return (
    <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-md text-[11px] font-bold uppercase tracking-[0.04em]", TILE[ext] ?? "bg-desk text-ink-2")} aria-hidden>
      {ext.slice(0, 4)}
    </span>
  );
}

const REASON: Record<string, string> = {
  "file-too-large": `larger than ${MAX_MB} MB`,
  "file-invalid-type": "not a supported file type",
  "too-many-files": "too many files at once",
};

/** Three sheets that fan apart while files are dragged over the zone. */
function SheetsIcon({ active, reject }: { active: boolean; reject: boolean }) {
  const t = "transition-transform duration-300 ease-out motion-reduce:transition-none";
  return (
    <span className="relative block h-14 w-14" aria-hidden>
      <span className={cn("absolute inset-x-2 top-1 h-11 rounded-md border-[1.5px] border-ink bg-sky", t, active ? "translate-x-4 rotate-[12deg]" : "translate-x-2 rotate-[7deg]")} />
      <span className={cn("absolute inset-x-2 top-1 h-11 rounded-md border-[1.5px] border-ink bg-canary", t, active ? "-translate-x-4 -rotate-[10deg]" : "-translate-x-1.5 -rotate-[5deg]")} />
      <span className={cn("absolute inset-x-2 top-1 grid h-11 place-items-center rounded-md border-[1.5px] border-ink", reject ? "bg-stop-soft" : "bg-paper", t, active && "-translate-y-1.5")}>
        <span className="block h-[1.5px] w-5 rounded bg-ink shadow-[0_5px_0_#15182B,0_-5px_0_#15182B]" />
      </span>
    </span>
  );
}

export function FileDropzone({ files, onFilesSelected, onFileRemoved, disabled, compact }: FileDropzoneProps) {
  const onDrop = useCallback((accepted: File[]) => accepted.length && onFilesSelected(accepted), [onFilesSelected]);
  const { getRootProps, getInputProps, isDragActive, isDragReject, fileRejections, open } = useDropzone({
    onDrop,
    accept: ACCEPT,
    multiple: true,
    disabled,
    maxSize: MAX_MB * 1024 * 1024,
    noClick: false,
  });
  // Each drop replaces the rejection list; dismissing hides only the list that was on screen.
  const [dismissed, setDismissed] = useState<unknown>(null);
  const rejections = fileRejections === dismissed ? [] : fileRejections;

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={cn(
          "group relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed text-center outline-none transition-[border-color,background-color,box-shadow] duration-200",
          compact ? "px-5 py-7" : "px-6 py-10 md:py-12",
          isDragActive && !isDragReject ? "border-ink bg-canary-soft shadow-[0_0_0_6px_rgba(255,224,102,0.35)]" : "border-line-strong bg-paper hover:border-ink-faint hover:bg-desk/40",
          isDragReject && "border-stop bg-stop-soft",
          "focus-visible:border-ink focus-visible:shadow-[0_0_0_4px_rgba(21,24,43,0.12)]",
          disabled && "pointer-events-none opacity-60"
        )}
      >
        <input {...getInputProps()} aria-label="Upload product files" />
        <SheetsIcon active={isDragActive} reject={isDragReject} />
        <p className="heading mt-4 text-[18px] text-ink">
          {isDragReject ? "Some of these files cannot be read" : isDragActive ? "Drop to add them" : "Drop product files here"}
        </p>
        <p className="mt-1 text-[14px] text-ink-muted">
          {isDragActive ? "Each file joins this brief." : (
            <>
              or <span className="font-semibold text-ink underline decoration-ink/30 underline-offset-2 group-hover:decoration-ink">browse your computer</span>
            </>
          )}
        </p>
        {!compact && (
          <ul className="mt-5 flex max-w-md flex-wrap justify-center gap-1.5" aria-label="Supported files">
            {[
              ["PDF", "artwork"],
              ["XLSX", "content sheet"],
              ["DOCX", "brief"],
              ["TXT · MD", "notes"],
              ["PNG · JPG", "scans"],
            ].map(([t, what]) => (
              <li key={t} className="inline-flex items-center gap-1 rounded-sm bg-desk px-2 py-1 text-[12px] text-ink-2">
                <b className="font-semibold text-ink">{t}</b> {what}
              </li>
            ))}
          </ul>
        )}
        <p className="meta mt-3">Up to {MAX_MB} MB each · add as many as you have</p>
      </div>

      {rejections.length > 0 && (
        <div role="alert" className="anim-rise flex items-start justify-between gap-3 rounded-lg border border-stop/30 bg-stop-soft px-4 py-3 text-[13.5px]">
          <div className="min-w-0">
            <p className="font-semibold text-ink">
              {rejections.length === 1 ? "One file was not added." : `${rejections.length} files were not added.`} Use PDF, XLSX, DOCX, TXT, MD, PNG or JPG, up to {MAX_MB} MB.
            </p>
            <ul className="mt-1 space-y-0.5 text-ink-2">
              {rejections.map((r) => (
                <li key={`${r.file.name}-${r.file.size}`} className="[overflow-wrap:anywhere]">
                  <b className="font-semibold">{r.file.name}</b>: {r.errors.map((e) => REASON[e.code] ?? e.message).join(", ")}
                </li>
              ))}
            </ul>
          </div>
          <button type="button" onClick={() => setDismissed(fileRejections)} className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-ink-muted hover:bg-stop/10 hover:text-ink" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {files.length > 0 && (
        <ul className="space-y-2" aria-label="Files to analyze">
          {files.map((file, idx) => {
            const { role } = fileRole(file.name);
            return (
              <li key={`${file.name}-${file.size}`} className="anim-rise flex items-center gap-3 rounded-lg border border-line bg-paper py-2.5 pl-2.5 pr-2 shadow-sheet">
                <FileTile file={file} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-ink" title={file.name}>
                    {file.name}
                  </p>
                  <p className="meta mt-0.5">
                    {role} · {formatSize(file.size)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onFileRemoved(idx)}
                  disabled={disabled}
                  className="pressable grid h-9 w-9 place-items-center rounded-md text-ink-muted transition-colors hover:bg-stop-soft hover:text-stop-deep disabled:opacity-40"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {files.length > 0 && !disabled && (
        <button type="button" onClick={open} className="text-[13px] font-semibold text-ink-2 underline decoration-ink/30 underline-offset-2 hover:text-ink hover:decoration-ink">
          Add more files
        </button>
      )}
    </div>
  );
}
