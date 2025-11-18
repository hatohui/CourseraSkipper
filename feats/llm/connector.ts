/**
 * LLM Connector for Coursera Quiz Solving
 * Integrates with Perplexity AI
 * Migrated from Python implementation
 */

import type {
  ResponseList,
  LLMMessage,
  LLMRequest,
  LLMResponse,
  LLMConnectorConfig,
} from "./types";

import {
  PERPLEXITY_API_URL,
  PERPLEXITY_API_KEY,
  PERPLEXITY_MODEL,
  RESPONSE_LIST_SCHEMA,
  SYSTEM_PROMPT,
} from "./config";

export class PerplexityConnector {
  private apiUrl: string;
  private apiKey: string;
  private model: string;

  constructor(config?: LLMConnectorConfig) {
    this.apiUrl = config?.apiUrl || PERPLEXITY_API_URL;
    this.apiKey = config?.apiKey || PERPLEXITY_API_KEY;
    this.model = config?.model || PERPLEXITY_MODEL;

    if (!this.apiKey) {
      throw new Error(
        "Perplexity API key is required. Please provide it in the constructor or set PERPLEXITY_API_KEY environment variable."
      );
    }
  }

  /**
   * Get responses for a set of questions from Perplexity AI
   * @param questions - Object mapping question IDs to question data
   * @returns ResponseList containing answers for all questions
   */
  async getResponse(questions: Record<string, any>): Promise<ResponseList> {
    try {
      console.log("[PerplexityConnector] Making API request to Perplexity...");

      const messages: LLMMessage[] = [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: JSON.stringify(questions),
        },
      ];

      const requestPayload: LLMRequest = {
        model: this.model,
        messages,
        response_format: {
          type: "json_schema",
          json_schema: {
            schema: RESPONSE_LIST_SCHEMA,
          },
        },
      };

      const response = await this.makeRequest(requestPayload);
      const result = this.parseResponse(response);

      console.log(
        `[PerplexityConnector] Successfully received ${result.responses.length} answers`
      );
      return result;
    } catch (error) {
      console.error("[PerplexityConnector] Error getting response:", error);
      throw error;
    }
  }

  /**
   * Make HTTP request to Perplexity API
   */
  private async makeRequest(payload: LLMRequest): Promise<LLMResponse> {
    try {
      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Perplexity API request failed: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const data = await response.json();
      return data as LLMResponse;
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("401")) {
          throw new Error(
            "Invalid Perplexity API key. Please check your configuration."
          );
        } else if (error.message.includes("429")) {
          throw new Error("Rate limit exceeded. Please try again later.");
        }
      }
      throw error;
    }
  }

  /**
   * Parse and validate the API response
   */
  private parseResponse(response: LLMResponse): ResponseList {
    try {
      if (!response.choices || response.choices.length === 0) {
        throw new Error("No choices in API response");
      }

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error("Empty content in API response");
      }

      const parsed = JSON.parse(content);

      // Validate structure
      if (!parsed.responses || !Array.isArray(parsed.responses)) {
        throw new Error(
          "Invalid response format: missing or invalid responses array"
        );
      }

      // Validate each response
      for (const resp of parsed.responses) {
        if (!resp.question_id || !resp.option_id || !resp.type) {
          throw new Error(
            `Invalid response format: missing required fields in response ${JSON.stringify(
              resp
            )}`
          );
        }

        if (!Array.isArray(resp.option_id)) {
          throw new Error(
            `Invalid response format: option_id must be an array in response ${JSON.stringify(
              resp
            )}`
          );
        }

        if (resp.type !== "Single" && resp.type !== "Multi") {
          throw new Error(
            `Invalid response format: type must be 'Single' or 'Multi' in response ${JSON.stringify(
              resp
            )}`
          );
        }
      }

      return parsed as ResponseList;
    } catch (error) {
      console.error("[PerplexityConnector] Error parsing response:", error);
      console.error("[PerplexityConnector] Raw response:", response);
      throw new Error(`Failed to parse API response: ${error}`);
    }
  }

  /**
   * Update API key
   */
  public updateApiKey(apiKey: string): void {
    if (!apiKey) {
      throw new Error("API key cannot be empty");
    }
    this.apiKey = apiKey;
  }

  /**
   * Update model
   */
  public updateModel(model: string): void {
    if (!model) {
      throw new Error("Model cannot be empty");
    }
    this.model = model;
  }

  /**
   * Get current configuration
   */
  public getConfig(): { apiUrl: string; model: string; hasApiKey: boolean } {
    return {
      apiUrl: this.apiUrl,
      model: this.model,
      hasApiKey: !!this.apiKey,
    };
  }
}

/**
 * Create a Perplexity connector instance
 */
export function createPerplexityConnector(
  apiKey?: string,
  model?: string
): PerplexityConnector {
  return new PerplexityConnector({ apiKey, model });
}

/**
 * Abstract interface for LLM connectors
 * Allows for future implementation of other LLM providers
 */
export interface ILLMConnector {
  getResponse(questions: Record<string, any>): Promise<ResponseList>;
  updateApiKey(apiKey: string): void;
  updateModel(model: string): void;
  getConfig(): { apiUrl: string; model: string; hasApiKey: boolean };
}
