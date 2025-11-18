/**
 * Configuration constants for LLM Connector
 */

export const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";

// API key should be stored in Chrome Storage for browser extension
// or provided directly in constructor
export const PERPLEXITY_API_KEY = "";

// Default model to use
export const PERPLEXITY_MODEL = "llama-3.1-sonar-small-128k-online";

/**
 * Available Perplexity models
 */
export const AVAILABLE_MODELS = [
  "llama-3.1-sonar-small-128k-online",
  "llama-3.1-sonar-large-128k-online",
  "llama-3.1-sonar-huge-128k-online",
] as const;

export type AvailableModel = (typeof AVAILABLE_MODELS)[number];

/**
 * JSON Schema for response validation
 */
export const RESPONSE_LIST_SCHEMA = {
  type: "object",
  properties: {
    responses: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question_id: {
            type: "string",
            description: "The ID of the question",
          },
          option_id: {
            type: "array",
            items: {
              type: "string",
            },
            description: "Array of selected option IDs",
          },
          type: {
            type: "string",
            enum: ["Single", "Multi"],
            description: "Whether single or multiple choice",
          },
        },
        required: ["question_id", "option_id", "type"],
        additionalProperties: false,
      },
    },
  },
  required: ["responses"],
  additionalProperties: false,
};

/**
 * System prompt for the LLM
 */
export const SYSTEM_PROMPT = `Answer the provided many questions. Be precise and concise. The questions are in a dict format with the key representing the question id and the value a JSON dict containing several things. Questions may have single-choice or multiple-choice answers, which would be specified by the user in the JSON data. The question/option values might have HTML data but ignore that.`;
