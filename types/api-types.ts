// API Response Types for Coursera Assessment System

import { QuestionResponse } from "./submission-types";

export interface Option {
  id: string;
  display: {
    definition: {
      value: string;
    };
  };
}

export interface QuestionSchema {
  id: string;
  type: string;
  prompt: {
    definition: {
      value: string;
    };
  };
  options?: Option[];
  variant?: {
    definition?: {
      value?: string;
    };
  };
}

export interface SubmissionState {
  id: string;
  questionId: string;
  response: QuestionResponse;
  submitted: boolean;
  graded: boolean;
}

export interface AttemptInfo {
  id: string;
  courseId: string;
  itemId: string;
  userId: string;
  attemptNumber: number;
  startedAt: number;
  completedAt?: number | null;
  score?: number | null;
  maxScore?: number | null;
}

export interface DraftInfo {
  id: string;
  attemptId: string;
  questionResponses: Record<string, QuestionResponse>;
  createdAt: number;
  updatedAt: number;
}

export interface GradeOutcome {
  id: string;
  attemptId: string;
  questionId: string;
  score: number;
  maxScore: number;
  feedback?: string | null;
  passed: boolean;
}

export interface SavedSubmissionPart {
  __typename: string;
  partId: string;
  questionSchema?: {
    prompt?: {
      cmlValue?: string;
      value?: string;
      htmlWithMetadata?: {
        html?: string;
        metadata?: {
          hasAssetBlock?: boolean;
          hasCodeBlock?: boolean;
          hasMath?: boolean;
          isPlainText?: boolean;
          __typename?: string;
        };
        __typename?: string;
      };
      __typename?: string;
    };
    options?: Array<{
      optionId: string;
      display?: {
        cmlValue?: string;
        value?: string;
        htmlWithMetadata?: {
          html?: string;
          __typename?: string;
        };
        __typename?: string;
      };
      __typename?: string;
    }>;
    __typename?: string;
  };
  [key: string]: any; // For response fields like checkboxResponse, multipleChoiceResponse, etc.
}
