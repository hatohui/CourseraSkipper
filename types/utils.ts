// Utility functions for working with question types

import { QuestionResponse } from "./submission-types";

/**
 * Creates a deep blank model by recursively setting all fields to null.
 * TypeScript version of the Python deep_blank_model function.
 *
 * Note: This is a simplified version since TypeScript doesn't have runtime
 * field introspection like Pydantic. For production use, consider using
 * JSON schema or runtime type information libraries.
 */
export function deepBlankModel(typeName: string): QuestionResponse {
  switch (typeName) {
    case "Submission_CheckboxQuestion":
      return { chosen: null };

    case "Submission_CodeExpressionQuestion":
      return { answer: { code: null } };

    case "Submission_FileUploadQuestion":
      return { caption: null, fileUrl: null, title: null };

    case "Submission_MathQuestion":
      return { answer: null };

    case "Submission_MultipleChoiceQuestion":
      return { chosen: null };

    case "Submission_MultipleFillableBlanksQuestion":
      return { responses: null };

    case "Submission_NumericQuestion":
      return { answer: "" };

    case "Submission_PlainTextQuestion":
      return { plainText: null };

    case "Submission_RegexQuestion":
      return { answer: null };

    case "Submission_RichTextQuestion":
      return { richText: { value: null } };

    case "Submission_TextExactMatchQuestion":
      return { answer: null };

    case "Submission_TextReflectQuestion":
      return { answer: null };

    case "Submission_UrlQuestion":
      return { caption: null, title: null, url: null };

    case "Submission_WidgetQuestion":
      return { answer: null };

    default:
      throw new Error(`Unknown question type: ${typeName}`);
  }
}
