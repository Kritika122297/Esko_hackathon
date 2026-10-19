import { create } from "zustand";
import {
  BriefField,
  ExtractionData,
  Issue,
  PackagingBrief,
  SmartQuestion,
  UploadResponse,
  WorkflowStep,
} from "@/lib/types";

interface BriefStore {
  // Workflow
  currentStep: WorkflowStep;
  completedSteps: WorkflowStep[];
  setStep: (step: WorkflowStep) => void;
  completeStep: (step: WorkflowStep) => void;

  // Session
  sessionId: string | null;
  setSessionId: (id: string) => void;

  // Upload
  uploadedFiles: File[];
  setUploadedFiles: (files: File[]) => void;
  addUploadedFiles: (files: File[]) => void;
  removeUploadedFile: (index: number) => void;
  uploadResponse: UploadResponse | null;
  setUploadResponse: (r: UploadResponse) => void;

  // Extraction
  extractionData: ExtractionData | null;
  setExtractionData: (data: ExtractionData) => void;

  // Brief
  brief: PackagingBrief | null;
  setBrief: (b: PackagingBrief) => void;
  updateBriefField: (
    sectionName: string,
    fieldName: string,
    newValue: any
  ) => void;

  // Issues
  issues: Issue[];
  setIssues: (issues: Issue[]) => void;
  resolveIssue: (issueId: string) => void;

  // Questions
  questions: SmartQuestion[];
  setQuestions: (q: SmartQuestion[]) => void;
  answers: Record<string, string>;
  setAnswer: (id: string, answer: string) => void;

  // Loading states
  isUploading: boolean;
  isAnalyzing: boolean;
  isExporting: boolean;
  setLoading: (key: "isUploading" | "isAnalyzing" | "isExporting" | string, value: boolean) => void;

  // Reset
  reset: () => void;
}

const initialStep: WorkflowStep = "upload";

export const useBriefStore = create<BriefStore>((set, get) => ({
  // Workflow
  currentStep: initialStep,
  completedSteps: [],
  setStep: (step) => set({ currentStep: step }),
  completeStep: (step) => {
    const currentCompleted = get().completedSteps;
    if (!currentCompleted.includes(step)) {
      set({ completedSteps: [...currentCompleted, step] });
    }
  },

  // Session
  sessionId: null,
  setSessionId: (id) => set({ sessionId: id }),

  // Upload
  uploadedFiles: [],
  setUploadedFiles: (files) => set({ uploadedFiles: files }),
  addUploadedFiles: (files) =>
    set((state) => ({ uploadedFiles: [...state.uploadedFiles, ...files] })),
  removeUploadedFile: (index) =>
    set((state) => ({
      uploadedFiles: state.uploadedFiles.filter((_, i) => i !== index),
    })),
  uploadResponse: null,
  setUploadResponse: (r) => set({ uploadResponse: r }),

  // Extraction
  extractionData: null,
  setExtractionData: (data) => set({ extractionData: data }),

  // Brief
  brief: null,
  setBrief: (brief) => set({ brief }),
  updateBriefField: (sectionName, fieldName, newValue) => {
    const currentBrief = get().brief;
    if (!currentBrief) return;

    const newSections = currentBrief.sections.map((sec) => {
      if (sec.section_name !== sectionName) return sec;
      return {
        ...sec,
        fields: sec.fields.map((fld) => {
          if (fld.field_name !== fieldName) return fld;
          return {
            ...fld,
            value: newValue,
            user_override: newValue,
            status: "confirmed" as const,
            issues: [],
          };
        }),
      };
    });

    // Recount remaining issues from fields
    let crit = 0;
    let warn = 0;
    let inf = 0;
    newSections.forEach((s) => {
      s.fields.forEach((f) => {
        if (f.status === "conflicting") crit++;
        else if (f.status === "flagged") warn++;
      });
    });

    set({
      brief: {
        ...currentBrief,
        sections: newSections,
        issues_summary: {
          critical: crit,
          warning: warn,
          info: inf,
        },
      },
    });
  },

  // Issues
  issues: [],
  setIssues: (issues) => set({ issues }),
  resolveIssue: (issueId) =>
    set((state) => ({
      issues: state.issues.filter((i) => i.id !== issueId),
    })),

  // Questions
  questions: [],
  setQuestions: (questions) => set({ questions }),
  answers: {},
  setAnswer: (id, answer) =>
    set((state) => ({
      answers: { ...state.answers, [id]: answer },
    })),

  // Loading states
  isUploading: false,
  isAnalyzing: false,
  isExporting: false,
  setLoading: (key, value) => set({ [key]: value }),

  // Reset
  reset: () =>
    set({
      currentStep: "upload",
      completedSteps: [],
      sessionId: null,
      uploadedFiles: [],
      uploadResponse: null,
      extractionData: null,
      brief: null,
      issues: [],
      questions: [],
      answers: {},
      isUploading: false,
      isAnalyzing: false,
      isExporting: false,
    }),
}));
