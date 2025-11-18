// webpack:///static/__generated__/graphql-types.ts
// Constants for question types and mappings

export const WHITELISTED_QUESTION_TYPES = [
  "Submission_CheckboxQuestion",
  "Submission_MultipleChoiceQuestion",
] as const;

export const QUESTION_TYPE_MAP: Record<string, [string, string]> = {
  Submission_CheckboxQuestion: ["checkboxResponse", "CHECKBOX"],
  Submission_CheckboxReflectQuestion: [
    "checkboxReflectResponse",
    "CHECKBOX_REFLECT",
  ],
  Submission_CodeExpressionQuestion: [
    "codeExpressionResponse",
    "CODE_EXPRESSION",
  ],
  Submission_FileUploadQuestion: ["fileUploadResponse", "FILE_UPLOAD"],
  Submission_MathQuestion: ["mathResponse", "MATH"],
  Submission_MultipleChoiceQuestion: [
    "multipleChoiceResponse",
    "MULTIPLE_CHOICE",
  ],
  Submission_MultipleChoiceReflectQuestion: [
    "multipleChoiceReflectResponse",
    "MULTIPLE_CHOICE_REFLECT",
  ],
  Submission_MultipleFillableBlanksQuestion: [
    "multipleFillableBlanksResponse",
    "MULTIPLE_FILLABLE_BLANKS",
  ],
  Submission_NumericQuestion: ["numericResponse", "NUMERIC"],
  Submission_OffPlatformQuestion: ["offPlatformResponse", "PLAIN_TEXT"],
  Submission_PlainTextQuestion: ["plainTextResponse", "PLAIN_TEXT"],
  Submission_RegexQuestion: ["regexResponse", "REGEX"],
  Submission_RichTextQuestion: ["richTextResponse", "RICH_TEXT"],
  Submission_TextExactMatchQuestion: [
    "textExactMatchResponse",
    "TEXT_EXACT_MATCH",
  ],
  Submission_TextReflectQuestion: ["textReflectResponse", "TEXT_REFLECT"],
  Submission_UrlQuestion: ["urlResponse", "URL"],
  Submission_WidgetQuestion: ["widgetResponse", "WIDGET"],
};

// Model map for runtime type name resolution
// Note: In TypeScript, interfaces don't exist at runtime, so this maps type names to their string identifiers
export const MODEL_MAP: Record<string, string> = {
  Submission_CheckboxQuestion: "Submission_CheckboxQuestion",
  Submission_CodeExpressionQuestion: "Submission_CodeExpressionQuestion",
  Submission_FileUploadQuestion: "Submission_FileUploadQuestion",
  Submission_MathQuestion: "Submission_MathQuestion",
  Submission_MultipleChoiceQuestion: "Submission_MultipleChoiceQuestion",
  Submission_MultipleFillableBlanksQuestion:
    "Submission_MultipleFillableBlanksQuestion",
  Submission_NumericQuestion: "Submission_NumericQuestion",
  Submission_PlainTextQuestion: "Submission_PlainTextQuestion",
  Submission_RegexQuestion: "Submission_RegexQuestion",
  Submission_RichTextQuestion: "Submission_RichTextQuestion",
  Submission_TextExactMatchQuestion: "Submission_TextExactMatchQuestion",
  Submission_TextReflectQuestion: "Submission_TextReflectQuestion",
  Submission_UrlQuestion: "Submission_UrlQuestion",
  Submission_WidgetQuestion: "Submission_WidgetQuestion",
};
