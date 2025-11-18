// webpack:///static/__generated__/graphql-types.ts
// Submission question type definitions

export interface Submission_CodeInput {
  code?: string | null;
}

export interface Submission_CheckboxQuestion {
  chosen?: string[] | null;
}

export interface Submission_CodeExpressionQuestion {
  answer?: Submission_CodeInput | null;
}

export interface Submission_FileUploadQuestion {
  caption?: string | null;
  fileUrl?: string | null;
  title?: string | null;
}

export interface Submission_MathQuestion {
  answer?: string | null;
}

export interface Submission_MultipleChoiceQuestion {
  chosen?: string | null;
}

export interface Submission_MultipleChoiceFillableBlank {
  id?: string | null;
  optionId?: string | null;
}

export interface Submission_FillableBlank {
  multipleChoiceFillableBlankResponse?: Submission_MultipleChoiceFillableBlank | null;
}

export interface Submission_MultipleFillableBlanksQuestion {
  responses?: Submission_FillableBlank[] | null;
}

export interface Submission_NumericQuestion {
  answer: ""; // Must be empty string, as per Python implementation :(
}

export interface Submission_PlainTextQuestion {
  plainText?: string | null;
}

export interface Submission_RegexQuestion {
  answer?: string | null;
}

export interface Submission_RichTextInput {
  value?: string | null;
}

export interface Submission_RichTextQuestion {
  richText?: Submission_RichTextInput | null;
}

export interface Submission_TextExactMatchQuestion {
  answer?: string | null;
}

export interface Submission_TextReflectQuestion {
  answer?: string | null;
}

export interface Submission_UrlQuestion {
  caption?: string | null;
  title?: string | null;
  url?: string | null;
}

export interface Submission_WidgetQuestion {
  answer?: any | null;
}

// Union type for all question response types
export type QuestionResponse =
  | Submission_CheckboxQuestion
  | Submission_CodeExpressionQuestion
  | Submission_FileUploadQuestion
  | Submission_MathQuestion
  | Submission_MultipleChoiceQuestion
  | Submission_MultipleFillableBlanksQuestion
  | Submission_NumericQuestion
  | Submission_PlainTextQuestion
  | Submission_RegexQuestion
  | Submission_RichTextQuestion
  | Submission_TextExactMatchQuestion
  | Submission_TextReflectQuestion
  | Submission_UrlQuestion
  | Submission_WidgetQuestion;
