"use client";

import React, { useState } from "react";
import {
  Check,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Pencil,
  Save,
  CheckCircle2,
  FolderKanban,
  FileText,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ProvenanceTag } from "@/components/review/ProvenanceTag";
import { BriefField, BriefSection, FieldStatus, PackagingBrief } from "@/lib/types";
import { useBriefStore } from "@/store/briefStore";
import { cn } from "@/lib/utils";

interface BriefEditorProps {
  brief: PackagingBrief;
}

export function BriefEditor({ brief }: BriefEditorProps) {
  const { updateBriefField } = useBriefStore();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});

  const handleStartEdit = (key: string, currentVal: any) => {
    setEditingKey(key);
    setDraftValues((prev) => ({
      ...prev,
      [key]: typeof currentVal === "string" ? currentVal : JSON.stringify(currentVal),
    }));
  };

  const handleSaveEdit = (
    sectionName: string,
    fieldName: string,
    key: string
  ) => {
    const val = draftValues[key];
    if (val !== undefined) {
      updateBriefField(sectionName, fieldName, val);
    }
    setEditingKey(null);
  };

  const handleCancelEdit = () => {
    setEditingKey(null);
  };

  const renderStatusBadge = (status: FieldStatus) => {
    switch (status) {
      case "confirmed":
        return (
          <Badge variant="success" className="gap-1 text-[11px] font-medium">
            <CheckCircle2 className="h-3 w-3" />
            Confirmed
          </Badge>
        );
      case "flagged":
        return (
          <Badge variant="warning" className="gap-1 text-[11px] font-medium">
            <AlertTriangle className="h-3 w-3" />
            Flagged
          </Badge>
        );
      case "missing":
        return (
          <Badge variant="destructive" className="gap-1 text-[11px] font-medium">
            <XCircle className="h-3 w-3" />
            Missing
          </Badge>
        );
      case "conflicting":
        return (
          <Badge
            variant="outline"
            className="gap-1 text-[11px] font-medium bg-purple-50 text-purple-700 border-purple-200"
          >
            <HelpCircle className="h-3 w-3" />
            Conflicting
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-4">
      <Accordion
        type="multiple"
        defaultValue={brief.sections.map((s) => s.section_name)}
        className="space-y-4"
      >
        {brief.sections.map((section, sIdx) => {
          const sectionIssues = section.fields.reduce(
            (acc, f) => acc + (f.issues?.length || 0),
            0
          );

          return (
            <AccordionItem
              key={section.section_name}
              value={section.section_name}
              className="border border-slate-200 rounded-xl bg-white shadow-2xs overflow-hidden"
            >
              <AccordionTrigger className="px-5 py-4 hover:no-underline bg-slate-50/70 border-b border-slate-100">
                <div className="flex items-center justify-between w-full pr-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-md bg-blue-100 text-blue-700 font-bold text-xs">
                      {sIdx + 1}
                    </div>
                    <span className="font-bold text-slate-900 text-base">
                      {section.section_name}
                    </span>
                    <span className="text-xs text-slate-400 font-normal">
                      ({section.fields.length} fields)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {sectionIssues > 0 ? (
                      <Badge variant="warning" className="text-xs">
                        {sectionIssues} Issue{sectionIssues > 1 ? "s" : ""}
                      </Badge>
                    ) : (
                      <Badge variant="success" className="text-xs">
                        All Validated
                      </Badge>
                    )}
                  </div>
                </div>
              </AccordionTrigger>

              <AccordionContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {section.fields.map((field) => {
                    const uniqueKey = `${section.section_name}:::${field.field_name}`;
                    const isEditing = editingKey === uniqueKey;
                    const isLongText =
                      String(field.value || "").length > 60 ||
                      field.field_name.toLowerCase().includes("ingredient");

                    return (
                      <div
                        key={field.field_name}
                        className={cn(
                          "p-4 transition-colors hover:bg-slate-50/50 flex flex-col md:flex-row md:items-start justify-between gap-4",
                          field.status === "conflicting" && "bg-purple-50/20",
                          field.status === "flagged" && "bg-amber-50/20"
                        )}
                      >
                        {/* Left column: Field Name & Provenance */}
                        <div className="w-full md:w-56 shrink-0 space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-xs text-slate-800">
                              {field.field_name}
                            </span>
                            {field.user_override && (
                              <Pencil
                                className="h-3 w-3 text-purple-600"
                                title="Manually edited value"
                              />
                            )}
                          </div>

                          <div>
                            <ProvenanceTag
                              source={field.source}
                              isOverride={Boolean(field.user_override)}
                            />
                          </div>
                        </div>

                        {/* Center column: Value input or display */}
                        <div className="flex-1 min-w-0 space-y-2">
                          {isEditing ? (
                            <div className="space-y-2">
                              {isLongText ? (
                                <Textarea
                                  value={draftValues[uniqueKey] || ""}
                                  onChange={(e) =>
                                    setDraftValues({
                                      ...draftValues,
                                      [uniqueKey]: e.target.value,
                                    })
                                  }
                                  rows={3}
                                  className="text-xs"
                                  autoFocus
                                />
                              ) : (
                                <Input
                                  value={draftValues[uniqueKey] || ""}
                                  onChange={(e) =>
                                    setDraftValues({
                                      ...draftValues,
                                      [uniqueKey]: e.target.value,
                                    })
                                  }
                                  className="text-xs h-8"
                                  autoFocus
                                />
                              )}

                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  className="h-7 text-xs gap-1"
                                  onClick={() =>
                                    handleSaveEdit(
                                      section.section_name,
                                      field.field_name,
                                      uniqueKey
                                    )
                                  }
                                >
                                  <Save className="h-3.5 w-3.5" />
                                  Save Change
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs text-slate-500"
                                  onClick={handleCancelEdit}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div
                              onClick={() =>
                                handleStartEdit(uniqueKey, field.value)
                              }
                              className="group/val cursor-pointer rounded-lg p-2 -m-2 hover:bg-slate-100/70 border border-transparent hover:border-slate-200 transition-all flex items-start justify-between gap-2"
                              title="Click to edit value"
                            >
                              <p className="text-xs text-slate-900 font-mono leading-relaxed break-words whitespace-pre-wrap">
                                {String(field.value || "—")}
                              </p>
                              <Pencil className="h-3.5 w-3.5 text-slate-400 opacity-0 group-hover/val:opacity-100 transition-opacity shrink-0 mt-0.5" />
                            </div>
                          )}

                          {/* Issues associated with this field */}
                          {field.issues && field.issues.length > 0 && (
                            <div className="space-y-1 pt-1">
                              {field.issues.map((iss, iIdx) => (
                                <div
                                  key={iIdx}
                                  className="flex items-start gap-1.5 text-[11px] text-amber-800 bg-amber-50/80 p-2 rounded border border-amber-200"
                                >
                                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                                  <span>{iss}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Right column: Status badge & Edit action */}
                        <div className="shrink-0 flex items-center md:flex-col md:items-end justify-between md:justify-start gap-2 pt-1">
                          {renderStatusBadge(field.status)}

                          {!isEditing && (
                            <button
                              type="button"
                              onClick={() =>
                                handleStartEdit(uniqueKey, field.value)
                              }
                              className="text-[11px] text-blue-600 hover:text-blue-800 font-medium hover:underline flex items-center gap-1"
                            >
                              <Pencil className="h-3 w-3" />
                              Edit
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
