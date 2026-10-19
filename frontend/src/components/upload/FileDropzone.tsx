"use client";

import React, { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  UploadCloud,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  File,
  X,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface FileDropzoneProps {
  files: File[];
  onFilesSelected: (files: File[]) => void;
  onFileRemoved: (index: number) => void;
  onLoadSampleFiles?: () => void;
}

export function FileDropzone({
  files,
  onFilesSelected,
  onFileRemoved,
  onLoadSampleFiles,
}: FileDropzoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFilesSelected(acceptedFiles);
      }
    },
    [onFilesSelected]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone({
      onDrop,
      accept: {
        "application/pdf": [".pdf"],
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
          ".xlsx",
        ],
        "application/vnd.ms-excel": [".xls"],
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
          ".docx",
        ],
        "application/msword": [".doc"],
        "image/png": [".png"],
        "image/jpeg": [".jpg", ".jpeg"],
      },
      multiple: true,
    });

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return <FileText className="h-6 w-6 text-red-500" />;
    if (ext === "xlsx" || ext === "xls")
      return <FileSpreadsheet className="h-6 w-6 text-emerald-600" />;
    if (ext === "docx" || ext === "doc")
      return <FileText className="h-6 w-6 text-blue-600" />;
    if (["png", "jpg", "jpeg"].includes(ext || ""))
      return <ImageIcon className="h-6 w-6 text-purple-600" />;
    return <File className="h-6 w-6 text-slate-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="space-y-6">
      {/* Drop Area */}
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 bg-white hover:bg-slate-50/80 shadow-xs relative overflow-hidden group",
          isDragActive && !isDragReject
            ? "border-blue-500 bg-blue-50/50 scale-[1.005]"
            : "border-slate-300 hover:border-blue-400",
          isDragReject && "border-red-500 bg-red-50/30"
        )}
      >
        <input {...getInputProps()} />

        <div className="mx-auto flex max-w-[440px] flex-col items-center justify-center text-center">
          <div className="h-16 w-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-inner">
            <UploadCloud className="h-8 w-8 stroke-[1.8]" />
          </div>

          <h3 className="font-semibold text-lg text-slate-900 mb-1">
            {isDragActive
              ? "Drop product documents here..."
              : "Drag & drop files here or click to browse"}
          </h3>
          <p className="text-sm text-slate-500 mb-5">
            Support for packaging PDF dielines, nutritional Excel sheets, brand
            briefs, and artwork images.
          </p>

          <div className="flex flex-wrap justify-center gap-1.5">
            <Badge variant="outline" className="text-xs bg-slate-50 text-slate-700">
              PDF Artwork
            </Badge>
            <Badge variant="outline" className="text-xs bg-slate-50 text-slate-700">
              XLSX Formulation
            </Badge>
            <Badge variant="outline" className="text-xs bg-slate-50 text-slate-700">
              DOCX Claims
            </Badge>
            <Badge variant="outline" className="text-xs bg-slate-50 text-slate-700">
              PNG/JPG Renders
            </Badge>
          </div>
        </div>
      </div>

      {/* Quick Demo Sample Files button */}
      {onLoadSampleFiles && files.length === 0 && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 text-white rounded-lg shadow-sm">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900">
                Want to test with sample packaging files?
              </h4>
              <p className="text-xs text-slate-600">
                Instantly load sample granola specs: PDF dieline, Excel nutrition sheet & claims doc.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onLoadSampleFiles}
            className="border-blue-300 text-blue-700 hover:bg-blue-100/70"
          >
            Load Sample Pack
          </Button>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-900">
              Uploaded Files ({files.length})
            </h4>
            <span className="text-xs text-slate-500">
              Total:{" "}
              {formatFileSize(
                files.reduce((acc, f) => acc + (f.size || 0), 0)
              )}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {files.map((file, idx) => (
              <div
                key={`${file.name}-${idx}`}
                className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors shadow-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 shrink-0">
                    {getFileIcon(file.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatFileSize(file.size)} • {file.name.split(".").pop()?.toUpperCase()}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onFileRemoved(idx)}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors ml-2"
                  title="Remove file"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
