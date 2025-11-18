/**
 * Type definitions for LLM Connector
 */

export interface ResponseFormat {
  question_id: string;
  option_id: string[];
  type: "Single" | "Multi";
}

export interface ResponseList {
  responses: ResponseFormat[];
}

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMRequest {
  model: string;
  messages: LLMMessage[];
  response_format?: {
    type: "json_schema";
    json_schema: {
      schema: any;
    };
  };
}

export interface LLMResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
    finish_reason: string;
  }>;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface LLMConnectorConfig {
  apiKey?: string;
  model?: string;
  apiUrl?: string;
}
