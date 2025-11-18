import { SavedSubmissionPart, QuestionResponse } from "../../types";

export interface QueryStateVariables {
  courseId: string;
  itemId: string;
}

export interface QueryStateResponse {
  SubmissionState: {
    queryState:
      | {
          __typename: "Submission_QueryStateFailure";
          errors: Array<{
            errorCode?: string;
            message?: string;
            __typename: string;
          }>;
        }
      | {
          __typename: "Submission_SubmissionState";
          allowedAction: "START_NEW_ATTEMPT" | "RESUME_DRAFT" | "VIEW_ONLY";
          assignment: {
            id: string;
            passingFraction: number;
            assignmentGradingType: string;
            gradeSelectionStrategy: string;
            requiredMobileFeatures: string[];
            learnerFeedbackVisibility: string;
          };
          integritySettings: {
            attemptId: string;
            session?: {
              id: string;
              isPrivate: boolean;
              __typename: string;
            };
            honorlockSettings?: {
              enabled: boolean;
              __typename: string;
            };
            lockingBrowserSettings?: {
              enabled: boolean;
              enabledForCurrentUser: boolean;
              __typename: string;
            };
            autoProctorSettings?: {
              enabled: boolean;
              clientId: string;
              hashedAttemptId: string;
              __typename: string;
            };
            courseraProctoringSettings?: {
              enabled: boolean;
              configuration: {
                primaryCameraConfig: {
                  cameraStatus: string;
                  recordingStatus: string;
                  monitoringStatus: string;
                  __typename: string;
                };
                secondaryCameraConfig: {
                  cameraStatus: string;
                  recordingStatus: string;
                  monitoringStatus: string;
                  __typename: string;
                };
                __typename: string;
              };
              __typename: string;
            };
            vivaExamSettings?: {
              status: string;
              __typename: string;
            };
            __typename: string;
          };
          submitter:
            | {
                __typename: "Submission_IndividualSubmitter";
                id: string;
              }
            | {
                __typename: "Submission_TeamSubmitter";
                id: string;
                name: string;
                teamActivityDescription: string;
                slackIntegrationMetadata?: {
                  slackGroupId: string;
                  slackTeamId: string;
                  slackTeamDomain: string;
                  __typename: string;
                };
                memberProfiles: Array<{
                  id: string;
                  email: string;
                  fullName: string;
                  photoUrl: string;
                  slackProfile?: {
                    slackTeamId: string;
                    slackUserId: string;
                    slackName: string;
                    deletedOrInactive: boolean;
                    __typename: string;
                  };
                  __typename: string;
                }>;
              };
          attempts: {
            lastSubmission?: {
              id: string;
              submission: {
                id: string;
                parts: Array<SavedSubmissionPart>;
                instructions?: {
                  overview?: {
                    cmlValue?: string;
                    value?: string;
                    __typename: string;
                  };
                  reviewCriteria?: {
                    cmlValue?: string;
                    value?: string;
                    __typename: string;
                  };
                  __typename: string;
                };
                lastSavedAt: string;
                __typename: string;
              };
              submittedAt: string;
              __typename: string;
            };
            nextAttempt?: {
              allowedDuration: number;
              submissionsAllowed: number;
              __typename: string;
            };
            attemptsAllowed: number;
            attemptsMade: number;
            attemptsRemaining: number;
            inProgressAttempt?: {
              id: string;
              allowedDuration: number;
              draft: {
                id: string;
                parts: Array<SavedSubmissionPart>;
                instructions?: {
                  overview?: {
                    cmlValue?: string;
                    value?: string;
                    __typename: string;
                  };
                  reviewCriteria?: {
                    cmlValue?: string;
                    value?: string;
                    __typename: string;
                  };
                  __typename: string;
                };
                lastSavedAt: string;
                __typename: string;
              };
              autoSubmissionRequired: boolean;
              remainingDuration: number;
              startedTime: string;
              submissionsAllowed: number;
              submissionsMade: number;
              submissionsRemaining: number;
              __typename: string;
            };
            rateLimiterConfig?: {
              attemptsRemainingIncreasesAt: string;
              maxPerInterval: number;
              timeIntervalDuration: number;
              __typename: string;
            };
            __typename: string;
          };
          feedback?: {
            feedbackId: string;
            outcome?: {
              latestScore: number;
              highestScore: number;
              maxScore: number;
              __typename: string;
            };
            __typename: string;
          };
          outcome?: {
            earnedGrade: number;
            gradeOverride?: {
              original: number;
              override: number;
              __typename: string;
            };
            isPassed: boolean;
            latePenaltyRatio: number;
            __typename: string;
          };
          manualGradingStatus: string;
          warnings: string[];
        };
    __typename: string;
  };
}

// ============================================================================
// SAVE_RESPONSES_QUERY Types
// ============================================================================

export interface SaveResponsesVariables {
  input: {
    attemptId: string;
    courseId: string;
    itemId: string;
    responses: Array<{
      partId: string;
      response: QuestionResponse;
    }>;
  };
}

export interface SaveResponsesResponse {
  Submission_SaveResponses:
    | {
        __typename: "Submission_SaveResponsesSuccess";
        submissionState: {
          allowedAction: string;
          warnings: string[];
          attempts: {
            inProgressAttempt?: {
              draft: {
                id: string;
                lastSavedAt: string;
                __typename: string;
              };
              __typename: string;
            };
            __typename: string;
          };
          __typename: string;
        };
      }
    | {
        __typename: "Submission_SaveResponsesFailure";
        errors: Array<{
          errorCode: string;
          __typename: string;
        }>;
      };
}

// ============================================================================
// SUBMIT_DRAFT_QUERY Types
// ============================================================================

export interface SubmitDraftVariables {
  input: {
    attemptId: string;
    courseId: string;
    itemId: string;
  };
}

export interface SubmitDraftResponse {
  Submission_SubmitLatestDraft:
    | {
        __typename: "Submission_SubmitLatestDraftSuccess";
        submissionState: {
          allowedAction: string;
          warnings: string[];
          __typename: string;
        };
      }
    | {
        __typename: "Submission_SubmitLatestDraftFailure";
        errors: Array<{
          errorCode: string;
          __typename: string;
        }>;
      };
}

// ============================================================================
// GRADING_STATUS_QUERY Types
// ============================================================================

export interface GradingStatusVariables {
  courseId: string;
  itemId: string;
}

export interface GradingStatusResponse {
  SubmissionState: {
    queryState:
      | {
          __typename: "Submission_QueryStateFailure";
          errors: Array<{
            message: string;
            __typename: string;
          }>;
        }
      | {
          __typename: "Submission_SubmissionState";
          gradingStatus: string;
        };
    __typename: string;
  };
}

// ============================================================================
// INITIATE_ATTEMPT_QUERY Types
// ============================================================================

export interface InitiateAttemptVariables {
  courseId: string;
  itemId: string;
}

export interface InitiateAttemptResponse {
  Submission_StartAttempt:
    | {
        __typename: "Submission_StartAttemptSuccess";
        submissionState: {
          assignment: {
            id: string;
            __typename: string;
          };
          __typename: string;
        };
      }
    | {
        __typename: "Submission_StartAttemptFailure";
        errors: Array<{
          errorCode: string;
          __typename: string;
        }>;
      };
}
