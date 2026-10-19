"use client";

import React, { useState } from "react";
import {
  FileText,
  FileSpreadsheet,
  File,
  Layers,
  MapPin,
  ExternalLink,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExtractionData } from "@/lib/types";
import { MOCK_EXTRACTION } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ExtractionViewProps {
  extractionData?: ExtractionData | null;
}

export function ExtractionView({ extractionData }: ExtractionViewProps) {
  const data = extractionData || MOCK_EXTRACTION;

  // Group texts by file
  const filesList = Array.from(
    new Set([
      ...data.texts.map((t) => t.source_file),
      ...data.tables.map((t) => t.source_file),
    ])
  );

  const [activeTab, setActiveTab] = useState<string>(
    filesList[0] || "Granola_Packaging_Spec_v2.pdf"
  );

  const getConfidenceDot = (conf: number) => {
    if (conf >= 0.9) return "bg-emerald-500 ring-emerald-200";
    if (conf >= 0.7) return "bg-amber-500 ring-amber-200";
    return "bg-red-500 ring-red-200";
  };

  const getFileBadgeIcon = (fileName: string) => {
    if (fileName.endsWith(".pdf"))
      return <FileText className="h-3.5 w-3.5 text-red-500" />;
    if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls"))
      return <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />;
    return <File className="h-3.5 w-3.5 text-blue-500" />;
  };

  return (
    <Card className="h-full flex flex-col border-slate-200 shadow-sm bg-white overflow-hidden">
      <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-blue-600" />
            <CardTitle className="text-base font-semibold text-slate-900">
              Extracted Source Data
            </CardTitle>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Raw text blocks, detected panels, and extracted nutritional tables
          </p>
        </div>
        <Badge variant="outline" className="text-xs bg-white text-slate-600">
          {filesList.length} Source Document{filesList.length > 1 ? "s" : ""}
        </Badge>
      </CardHeader>

      <CardContent className="p-4 flex-1 overflow-y-auto">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full flex flex-col h-full"
        >
          {/* File selector tabs */}
          <TabsList className="w-full justify-start overflow-x-auto bg-slate-100 p-1 mb-4 h-auto gap-1">
            {filesList.map((file) => (
              <TabsTrigger
                key={file}
                value={file}
                className="text-xs py-1.5 px-3 flex items-center gap-2 whitespace-nowrap data-[state=active]:bg-white data-[state=active]:shadow-xs"
              >
                {getFileBadgeIcon(file)}
                <span className="truncate max-w-[150px]">{file}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Tab contents for each file */}
          {filesList.map((file) => {
            const fileTexts = data.texts.filter((t) => t.source_file === file);
            const fileTables = data.tables.filter((t) => t.source_file === file);

            return (
              <TabsContent
                key={file}
                value={file}
                className="space-y-4 focus-visible:outline-none mt-0"
              >
                {/* Text blocks */}
                {fileTexts.length > 0 && (
                  <div className="space-y-2.5">
                    <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Extracted Text Elements ({fileTexts.length})
                    </h5>
                    {fileTexts.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg border border-slate-200/90 bg-slate-50/40 hover:bg-slate-50 transition-colors text-xs space-y-2 group"
                      >
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <div className="flex items-center gap-1.5 font-medium text-slate-700">
                            <MapPin className="h-3 w-3 text-blue-500" />
                            <span>{item.location}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                "h-2 w-2 rounded-full ring-2",
                                getConfidenceDot(item.confidence)
                              )}
                            />
                            <span className="text-[10px] text-slate-400">
                              {Math.round(item.confidence * 100)}% match
                            </span>
                          </div>
                        </div>

                        <p className="text-slate-800 font-mono text-[11.5px] leading-relaxed bg-white p-2 rounded border border-slate-200/60 break-words">
                          {item.text}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Formatted Tables (from Excel or PDF) */}
                {fileTables.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Extracted Tables ({fileTables.length})
                    </h5>
                    {fileTables.map((tbl, tIdx) => (
                      <div
                        key={tIdx}
                        className="rounded-lg border border-slate-200 overflow-hidden shadow-2xs"
                      >
                        {tbl.title && (
                          <div className="bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 border-b border-slate-200">
                            {tbl.title}
                          </div>
                        )}
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                                {tbl.headers.map((h, hIdx) => (
                                  <th
                                    key={hIdx}
                                    className="py-2 px-3 font-semibold text-[11px] uppercase tracking-wider"
                                  >
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {tbl.rows.map((row, rIdx) => (
                                <tr
                                  key={rIdx}
                                  className="hover:bg-slate-50/80 transition-colors"
                                >
                                  {tbl.headers.map((h, hIdx) => {
                                    const val =
                                      Array.isArray(row)
                                        ? row[hIdx]
                                        : (row as any)[h];
                                    return (
                                      <td
                                        key={hIdx}
                                        className="py-1.5 px-3 font-mono text-[11px] text-slate-700 whitespace-nowrap"
                                      >
                                        {val ?? "-"}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {fileTexts.length === 0 && fileTables.length === 0 && (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No text or table entities extracted for this file.
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </CardContent>
    </Card>
  );
}
