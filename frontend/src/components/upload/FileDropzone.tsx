"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { FileImage, FileSpreadsheet, FileText, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileDropzoneProps {
  files: File[];
  onFilesSelected: (files: File[]) => void;
  onFileRemoved: (index: number) => void;
  disabled?: boolean;
}

const ACCEPT = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "text/plain": [".txt", ".md"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
};

/** The role BriefForge gives each file, from its type (matches the backend readers). */
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

export function FileDropzone({ files, onFilesSelected, onFileRemoved, disabled }: FileDropzoneProps) {
  const onDrop = useCallback((accepted: File[]) => accepted.length && onFilesSelected(accepted), [onFilesSelected]);
  const { getRootProps, getInputProps, isDragActive, isDragReject, fileRejections } = useDropzone({
    onDrop,
    accept: ACCEPT,
    multiple: true,
    disabled,
    maxSize: 50 * 1024 * 1024,
  });

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={cn(
          "group relative flex cursor-pointer flex-col items-center justify-center rounded border-2 border-dashed bg-stock px-6 py-10 text-center transition-[border-color,background-color] duration-200",
          isDragActive && !isDragReject ? "border-rail bg-ok-soft" : "border-line-strong hover:border-ink-faint",
          isDragReject && "border-stop bg-stop-soft",
          disabled && "pointer-events-none opacity-60"
        )}
      >
        <input {...getInputProps()} aria-label="Upload product files" />
        <UploadCloud className={cn("h-9 w-9 transition-transform duration-300 ease-out", isDragActive ? "-translate-y-1 text-rail" : "text-ink-faint group-hover:-translate-y-0.5")} />
        <p className="mt-3 text-[16px] font-bold text-ink">{isDragActive ? "Drop to add the files" : "Drop product files here, or browse"}</p>
        <p className="mt-1 max-w-md text-sm text-ink-muted">Packaging artwork PDF, content sheet, brief documents or notes. Add as many as you have.</p>
        <p className="mt-3 meta text-ink-muted">PDF · XLSX · DOCX · TXT · MD · PNG · JPG · up to 50 MB each</p>
      </div>

      {fileRejections.length > 0 && (
        <p role="alert" className="text-sm text-stop-deep">
          Not added: {fileRejections.map((r) => r.file.name).join(", ")}. Use one of the listed file types, up to 50 MB.
        </p>
      )}

      {files.length > 0 && (
        <ul className="space-y-1.5" aria-label="Files to analyze">
          {files.map((file, idx) => {
            const { role, icon: Icon } = fileRole(file.name);
            return (
              <li key={`${file.name}-${idx}`} className="ticket anim-rise flex items-center gap-3 py-2.5 pl-3 pr-2">
                <Icon className="h-5 w-5 shrink-0 text-rail" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{file.name}</p>
                  <p className="meta text-ink-muted">
                    {role} · {formatSize(file.size)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onFileRemoved(idx)}
                  disabled={disabled}
                  className="grid h-8 w-8 place-items-center rounded text-ink-muted hover:bg-stop-soft hover:text-stop-deep"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
