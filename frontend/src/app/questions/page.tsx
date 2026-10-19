"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SmartQuestions } from "@/components/questions/SmartQuestions";
import { useBriefStore } from "@/store/briefStore";
import { api, MOCK_QUESTIONS } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

export default function QuestionsPage() {
  const router = useRouter();
  const {
    sessionId,
    questions,
    setQuestions,
    answers,
    setAnswer,
    setBrief,
    completeStep,
    setStep,
  } = useBriefStore();

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadQuestions() {
      if (questions.length === 0) {
        setIsLoading(true);
        try {
          const fetched = await api.getQuestions(sessionId || "demo-session-42");
          setQuestions(fetched);
        } catch (e) {
          console.error(e);
          setQuestions(MOCK_QUESTIONS);
        } finally {
          setIsLoading(false);
        }
      }
    }
    loadQuestions();
  }, [sessionId, questions.length, setQuestions]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const updatedBrief = await api.submitAnswers(
        sessionId || "demo-session-42",
        answers
      );
      setBrief(updatedBrief);
      completeStep("questions");
      setStep("review");
      router.push("/review");
    } catch (e) {
      console.error(e);
      completeStep("questions");
      setStep("review");
      router.push("/review");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto py-4">
      {/* Page Header */}
      <div className="border-b border-slate-200 pb-5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600 mb-1">
          <span>Step 3 of 5</span>
          <span>•</span>
          <span>Smart Discrepancy Resolution</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          We Need Your Input
        </h1>
        <p className="text-slate-500 mt-1 text-base">
          These follow-up questions address mathematical contradictions and packaging claim conflicts detected across your source files.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : (
        <SmartQuestions
          questions={questions.length > 0 ? questions : MOCK_QUESTIONS}
          answers={answers}
          onAnswerChange={setAnswer}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
}
