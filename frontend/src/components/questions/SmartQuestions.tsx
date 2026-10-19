"use client";

import React from "react";
import {
  HelpCircle,
  AlertCircle,
  Sparkles,
  ArrowRight,
  CheckCircle,
  CornerDownRight,
  Tag,
  Loader2,
} from "lucide-react";
import { SmartQuestion } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface SmartQuestionsProps {
  questions: SmartQuestion[];
  answers: Record<string, string>;
  onAnswerChange: (id: string, answer: string) => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
}

export function SmartQuestions({
  questions,
  answers,
  onAnswerChange,
  onSubmit,
  isSubmitting = false,
}: SmartQuestionsProps) {
  const mustAnswer = questions.filter((q) => q.priority === "must_answer");
  const niceToHave = questions.filter((q) => q.priority === "nice_to_have");

  const handleAcceptSuggestion = (q: SmartQuestion) => {
    if (q.suggested_answer) {
      onAnswerChange(q.id, q.suggested_answer);
    }
  };

  const answeredCount = Object.keys(answers).filter(
    (k) => answers[k] && answers[k].trim().length > 0
  ).length;

  const mustAnswerCompleted = mustAnswer.every(
    (q) => answers[q.id] && answers[q.id].trim().length > 0
  );

  const renderQuestionCard = (question: SmartQuestion) => {
    const currentVal = answers[question.id] || "";
    const isAnswered = currentVal.trim().length > 0;
    const isMust = question.priority === "must_answer";

    return (
      <Card
        key={question.id}
        className={cn(
          "transition-all duration-200 border bg-white shadow-2xs hover:shadow-xs",
          isAnswered
            ? "border-emerald-200/80 bg-emerald-50/10"
            : isMust
            ? "border-red-200/90 hover:border-red-300"
            : "border-slate-200 hover:border-slate-300"
        )}
      >
        <CardContent className="p-5 space-y-4">
          {/* Header row: Priority Badge + Related Field */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge
                variant={isMust ? "destructive" : "info"}
                className="text-[11px] font-semibold uppercase tracking-wider"
              >
                {isMust ? "Must Answer" : "Recommended"}
              </Badge>

              <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                <Tag className="h-3 w-3 text-slate-400" />
                <span>Field: {question.related_field}</span>
              </div>
            </div>

            {isAnswered && (
              <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                <CheckCircle className="h-3.5 w-3.5" />
                Answered
              </span>
            )}
          </div>

          {/* Question text */}
          <div>
            <h4 className="text-base font-bold text-slate-900 leading-snug">
              {question.question}
            </h4>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              {question.context}
            </p>
          </div>

          {/* Suggested Answer Pill */}
          {question.suggested_answer && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-blue-50/70 border border-blue-200/70 text-xs">
              <div className="flex items-start gap-2 min-w-0">
                <Sparkles className="h-3.5 w-3.5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-blue-900 mr-1.5">
                    AI Suggested Resolution:
                  </span>
                  <span className="italic text-blue-950 font-medium">
                    &ldquo;{question.suggested_answer}&rdquo;
                  </span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAcceptSuggestion(question)}
                className="h-7 text-xs bg-white text-blue-700 border-blue-200 hover:bg-blue-100/60 shrink-0 self-end sm:self-auto"
              >
                Use Suggestion
              </Button>
            </div>
          )}

          {/* Input field */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
              <CornerDownRight className="h-3 w-3 text-slate-400" />
              Your Decision / Brief Value:
            </label>
            <Textarea
              value={currentVal}
              onChange={(e) => onAnswerChange(question.id, e.target.value)}
              placeholder={
                question.suggested_answer
                  ? `e.g. ${question.suggested_answer}`
                  : "Type your answer or instruction here..."
              }
              rows={2}
              className="text-xs focus:ring-blue-600 border-slate-300"
            />
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-8">
      {/* Overview progress banner */}
      <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div>
          <h4 className="text-sm font-bold flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-blue-400" />
            Human-in-the-Loop Clarifications
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            AI flags ambiguities; you decide the definitive spec before generating the packaging brief.
          </p>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          <div className="text-right">
            <div className="text-xs font-semibold text-white">
              {answeredCount} of {questions.length} Addressed
            </div>
            <div className="text-[11px] text-slate-400">
              {mustAnswerCompleted
                ? "All critical items answered"
                : "Required answers pending"}
            </div>
          </div>
        </div>
      </div>

      {/* Must Answer Section */}
      {mustAnswer.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              Critical Conflicts (Must Answer)
            </h3>
            <Badge variant="destructive" className="text-xs">
              {mustAnswer.length}
            </Badge>
          </div>
          <div className="space-y-3">{mustAnswer.map(renderQuestionCard)}</div>
        </div>
      )}

      {/* Nice to Have Section */}
      {niceToHave.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-600" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              Recommended Specifications
            </h3>
            <Badge variant="info" className="text-xs">
              {niceToHave.length}
            </Badge>
          </div>
          <div className="space-y-3">{niceToHave.map(renderQuestionCard)}</div>
        </div>
      )}

      {/* Bottom Submit Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-slate-200">
        <div className="text-xs text-slate-500">
          {!mustAnswerCompleted && (
            <span className="text-amber-700 font-medium flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" />
              Tip: You can use the AI suggestion buttons to quickly resolve the critical items.
            </span>
          )}
          {mustAnswerCompleted && (
            <span className="text-emerald-700 font-medium flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5" />
              Ready! Answers will be merged into the draft brief fields.
            </span>
          )}
        </div>

        <Button
          size="lg"
          onClick={onSubmit}
          disabled={isSubmitting}
          className="gap-2 px-6 w-full sm:w-auto shadow-sm"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Applying Decisions...
            </>
          ) : (
            <>
              Submit Answers & Review Brief
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
