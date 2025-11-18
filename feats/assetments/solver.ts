import {
  WHITELISTED_QUESTION_TYPES,
  QUESTION_TYPE_MAP,
  MODEL_MAP,
  deepBlankModel,
  type SavedSubmissionPart,
} from "../../types";

import { GraphQLClient, createCourseraClient } from "./graphql-client";
import {
  GET_STATE_QUERY,
  SAVE_RESPONSES_QUERY,
  SUBMIT_DRAFT_QUERY,
  INITIATE_ATTEMPT_QUERY,
} from "./queries";

import type { QueryStateResponse } from "./query-types";

/**
 * Formatted question structure for LLM
 */
export interface FormattedQuestion {
  Question: string;
  Options: Array<{
    option_id: string;
    value: string;
  }>;
  Type: "Single-Choice" | "Multi-Choice";
}

/**
 * LLM Answer format
 */
export interface LLMAnswer {
  question_id: string;
  type: "Single" | "Multi";
  option_id: string[];
}

/**
 * Discarded question for later submission
 */
interface DiscardedQuestion {
  questionId: string;
  questionType: string;
  questionResponse: Record<string, any>;
}

export interface SolverConfig {
  courseId: string;
  itemId: string;
  client?: GraphQLClient;
}

export class GradedSolver {
  private courseId: string;
  private itemId: string;
  private attemptId: string | null = null;
  private draftId: string | null = null;
  private discardedQuestions: DiscardedQuestion[] = [];
  private client: GraphQLClient;

  constructor(config: SolverConfig) {
    this.courseId = config.courseId;
    this.itemId = config.itemId;
    this.client = config.client || createCourseraClient();
  }

  /**
   * Main solve method - orchestrates the entire solving process
   */
  async solve(llmConnector: any): Promise<void> {
    const state = await this.getState();

    if (state.allowedAction === "RESUME_DRAFT") {
      console.error(
        "[GradedSolver] An attempt is already in progress, please abort it manually."
      );
      return;
    }

    if (state.allowedAction === "START_NEW_ATTEMPT") {
      // Check if already passed
      if (state.outcome !== null && state.outcome?.isPassed) {
        console.log("[GradedSolver] Already passed!");
        return;
      }

      // Check remaining attempts
      if (state.attempts?.attemptsRemaining === 0) {
        console.error("[GradedSolver] No more attempts can be made!");
        return;
      }

      // Initiate new attempt
      if (!(await this.initiateAttempt())) {
        console.error(
          "[GradedSolver] Could not start an attempt. Please file an issue."
        );
        return;
      }

      // Retrieve questions
      const questions = await this.retrieveQuestions();

      // Get answers from LLM
      const answers = await llmConnector.getResponse(questions);

      // Save responses
      if (!(await this.saveResponses(answers.responses))) {
        console.error(
          "[GradedSolver] Could not save responses. Please file an issue."
        );
        return;
      }

      // Submit draft
      if (!(await this.submitDraft())) {
        console.error(
          "[GradedSolver] Could not submit the assignment. Please file an issue."
        );
        return;
      }

      // Wait for grading
      console.log("[GradedSolver] Waiting 3 seconds for grading...");
      await this.delay(3000);

      // Get grade
      if (!(await this.getGrade())) {
        console.error(
          "[GradedSolver] Sorry! Could not pass the assignment, maybe use a better model."
        );
      }
    } else {
      console.error(
        "[GradedSolver] Something went wrong! Please file an issue."
      );
    }
  }

  /**
   * Get current submission state
   */
  async getState(): Promise<any> {
    try {
      const response = await this.client.query<QueryStateResponse>(
        GET_STATE_QUERY,
        {
          courseId: this.courseId,
          itemId: this.itemId,
        },
        "QueryState"
      );

      return response.SubmissionState.queryState;
    } catch (error) {
      console.error("[GradedSolver] Error getting state:", error);
      throw error;
    }
  }

  /**
   * Initiate a new attempt
   */
  async initiateAttempt(): Promise<boolean> {
    try {
      const response = await this.client.query(
        INITIATE_ATTEMPT_QUERY,
        {
          courseId: this.courseId,
          itemId: this.itemId,
        },
        "Submission_StartAttempt"
      );

      const responseText = JSON.stringify(response);
      return responseText.includes("Submission_StartAttemptSuccess");
    } catch (error) {
      console.error("[GradedSolver] Error initiating attempt:", error);
      return false;
    }
  }

  /**
   * Retrieve and format questions from the draft
   */
  async retrieveQuestions(): Promise<Record<string, FormattedQuestion>> {
    try {
      const state = await this.getState();
      const draft = state.attempts?.inProgressAttempt;

      if (!draft) {
        throw new Error("No in-progress attempt found");
      }

      this.draftId = draft.id;
      this.attemptId = draft.draft.id;

      const questions = draft.draft.parts as SavedSubmissionPart[];
      const questionsFormatted: Record<string, FormattedQuestion> = {};

      for (const question of questions) {
        const typename = question.__typename;

        // Check if question type is whitelisted
        if (!WHITELISTED_QUESTION_TYPES.includes(typename as any)) {
          const [responseKey, questionType] = QUESTION_TYPE_MAP[typename] || [
            "",
            "",
          ];
          const model = MODEL_MAP[typename];

          this.discardedQuestions.push({
            questionId: question.partId,
            questionType: questionType,
            questionResponse: {
              [responseKey]: deepBlankModel(model),
            },
          });
          continue;
        }

        // Extract options
        const options = [];
        if (question.questionSchema?.options) {
          for (const option of question.questionSchema.options) {
            options.push({
              option_id: option.optionId,
              value: option.display?.cmlValue || option.display?.value || "",
            });
          }
        }

        // Format question
        const questionText =
          question.questionSchema?.prompt?.cmlValue ||
          question.questionSchema?.prompt?.value ||
          "";

        const type =
          typename === "Submission_MultipleChoiceQuestion"
            ? "Single-Choice"
            : "Multi-Choice";

        questionsFormatted[question.partId] = {
          Question: questionText,
          Options: options,
          Type: type,
        };
      }

      return questionsFormatted;
    } catch (error) {
      console.error("[GradedSolver] Error retrieving questions:", error);
      throw error;
    }
  }

  /**
   * Save responses to the draft
   */
  async saveResponses(answers: LLMAnswer[]): Promise<boolean> {
    try {
      if (!this.draftId) {
        throw new Error("No draft ID available");
      }

      const answerResponses = [];

      for (const answer of answers) {
        const responseKey =
          answer.type === "Single"
            ? "multipleChoiceResponse"
            : "checkboxResponse";
        const questionType =
          answer.type === "Single" ? "MULTIPLE_CHOICE" : "CHECKBOX";

        answerResponses.push({
          questionId: answer.question_id,
          questionType: questionType,
          questionResponse: {
            [responseKey]: {
              chosen:
                answer.type === "Single"
                  ? answer.option_id[0]
                  : answer.option_id,
            },
          },
        });
      }

      const allResponses = [...answerResponses, ...this.discardedQuestions];

      const response = await this.client.query(
        SAVE_RESPONSES_QUERY,
        {
          input: {
            courseId: this.courseId,
            itemId: this.itemId,
            attemptId: this.draftId,
            questionResponses: allResponses,
          },
        },
        "Submission_SaveResponses"
      );

      const responseText = JSON.stringify(response);

      if (responseText.includes("Submission_SaveResponsesSuccess")) {
        return true;
      }

      console.log("[GradedSolver] Response payload:", allResponses);
      console.log("[GradedSolver] API response:", response);
      return false;
    } catch (error) {
      console.error("[GradedSolver] Error saving responses:", error);
      return false;
    }
  }

  /**
   * Submit the draft
   */
  async submitDraft(): Promise<boolean> {
    try {
      if (!this.attemptId) {
        throw new Error("No attempt ID available");
      }

      const response = await this.client.query(
        SUBMIT_DRAFT_QUERY,
        {
          input: {
            courseId: this.courseId,
            itemId: this.itemId,
            submissionId: this.attemptId,
          },
        },
        "Submission_SubmitLatestDraft"
      );

      const responseText = JSON.stringify(response);
      return responseText.includes("Submission_SubmitLatestDraftSuccess");
    } catch (error) {
      console.error("[GradedSolver] Error submitting draft:", error);
      return false;
    }
  }

  /**
   * Get grade outcome after submission
   */
  async getGrade(): Promise<boolean> {
    try {
      const response = await this.client.query<QueryStateResponse>(
        GET_STATE_QUERY,
        {
          courseId: this.courseId,
          itemId: this.itemId,
        },
        "QueryState"
      );

      const queryState = response.SubmissionState.queryState;

      if (queryState.__typename === "Submission_QueryStateFailure") {
        console.warn("[GradedSolver] Query state returned failure");
        return false;
      }

      const outcome = queryState.outcome;

      if (!outcome) {
        console.warn("[GradedSolver] No outcome found");
        return false;
      }

      console.log(
        `[GradedSolver] Achieved ${outcome.earnedGrade} grade. Passed? ${outcome.isPassed}`
      );

      return outcome.isPassed;
    } catch (error) {
      console.error("[GradedSolver] Error getting grade:", error);
      return false;
    }
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create a solver instance
 */
export function createSolver(courseId: string, itemId: string): GradedSolver {
  return new GradedSolver({ courseId, itemId });
}
