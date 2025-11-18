// Type guard functions for runtime type checking

import {
  Submission_CheckboxQuestion,
  Submission_MultipleChoiceQuestion,
  Submission_CodeExpressionQuestion,
  Submission_RichTextQuestion,
} from "./submission-types";

export function isCheckboxQuestion(
  obj: any
): obj is Submission_CheckboxQuestion {
  return obj && typeof obj === "object" && "chosen" in obj;
}

export function isMultipleChoiceQuestion(
  obj: any
): obj is Submission_MultipleChoiceQuestion {
  return (
    obj &&
    typeof obj === "object" &&
    "chosen" in obj &&
    !Array.isArray(obj.chosen)
  );
}

export function isCodeExpressionQuestion(
  obj: any
): obj is Submission_CodeExpressionQuestion {
  return (
    obj &&
    typeof obj === "object" &&
    "answer" in obj &&
    obj.answer &&
    "code" in obj.answer
  );
}

export function isRichTextQuestion(
  obj: any
): obj is Submission_RichTextQuestion {
  return obj && typeof obj === "object" && "richText" in obj;
}
