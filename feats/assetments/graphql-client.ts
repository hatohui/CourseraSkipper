/**
 * GraphQL Client for Coursera API
 * Handles GraphQL requests with error handling, retry logic, and authentication
 */

import type {
  QueryStateVariables,
  QueryStateResponse,
  SaveResponsesVariables,
  SaveResponsesResponse,
  SubmitDraftVariables,
  SubmitDraftResponse,
  GradingStatusVariables,
  GradingStatusResponse,
  InitiateAttemptVariables,
  InitiateAttemptResponse,
} from "./query-types";

export interface GraphQLError {
  message: string;
  errorCode?: string;
  __typename?: string;
}

export interface GraphQLResponse<T> {
  data?: T;
  errors?: GraphQLError[];
}

export interface GraphQLClientConfig {
  baseUrl: string;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

export class GraphQLClient {
  private baseUrl: string;
  private maxRetries: number;
  private retryDelay: number;
  private timeout: number;

  constructor(config: GraphQLClientConfig) {
    this.baseUrl = config.baseUrl;
    this.maxRetries = config.maxRetries ?? 3;
    this.retryDelay = config.retryDelay ?? 1000;
    this.timeout = config.timeout ?? 30000;
  }

  /**
   * Execute a GraphQL query with retry logic
   */
  async query<TResponse, TVariables = Record<string, any>>(
    query: string,
    variables: TVariables,
    operationName?: string
  ): Promise<TResponse> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.executeRequest<TResponse, TVariables>(
          query,
          variables,
          operationName
        );

        if (response.errors && response.errors.length > 0) {
          throw new Error(
            `GraphQL errors: ${response.errors
              .map((e) => e.message)
              .join(", ")}`
          );
        }

        if (!response.data) {
          throw new Error("No data returned from GraphQL query");
        }

        return response.data;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on client errors (4xx)
        if (error instanceof Error && error.message.includes("400")) {
          throw lastError;
        }

        // If this is the last attempt, throw the error
        if (attempt === this.maxRetries) {
          throw lastError;
        }

        // Wait before retrying with exponential backoff
        await this.delay(this.retryDelay * Math.pow(2, attempt));
      }
    }

    throw lastError || new Error("Request failed after all retries");
  }

  /**
   * Execute the actual HTTP request
   */
  private async executeRequest<TResponse, TVariables>(
    query: string,
    variables: TVariables,
    operationName?: string
  ): Promise<GraphQLResponse<TResponse>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...this.getAuthHeaders(),
        },
        body: JSON.stringify({
          query,
          variables,
          operationName,
        }),
        credentials: "include", // Include cookies for authentication
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `HTTP error! status: ${response.status} ${response.statusText}`
        );
      }

      const result = await response.json();
      return result as GraphQLResponse<TResponse>;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Get authentication headers
   * In a browser extension, these would come from cookies or storage
   */
  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};

    // CSRF token (would be retrieved from cookie or storage)
    const csrfToken = this.getCsrfToken();
    if (csrfToken) {
      headers["X-CSRF3-Token"] = csrfToken;
    }

    return headers;
  }

  /**
   * Get CSRF token from cookies
   * In a browser extension, this would use chrome.cookies API
   */
  private getCsrfToken(): string | null {
    // This is a placeholder - in actual implementation:
    // - For content script: read from document.cookie
    // - For background script: use chrome.cookies.get()
    const match = document.cookie.match(/CSRF3-Token=([^;]+)/);
    return match ? match[1] : null;
  }

  /**
   * Delay utility for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Type-safe query methods for specific operations
   */

  async queryState(
    variables: QueryStateVariables
  ): Promise<QueryStateResponse> {
    return this.query<QueryStateResponse, QueryStateVariables>(
      "", // Query would be passed in
      variables,
      "QueryState"
    );
  }

  async saveResponses(
    variables: SaveResponsesVariables
  ): Promise<SaveResponsesResponse> {
    return this.query<SaveResponsesResponse, SaveResponsesVariables>(
      "", // Query would be passed in
      variables,
      "Submission_SaveResponses"
    );
  }

  async submitDraft(
    variables: SubmitDraftVariables
  ): Promise<SubmitDraftResponse> {
    return this.query<SubmitDraftResponse, SubmitDraftVariables>(
      "", // Query would be passed in
      variables,
      "Submission_SubmitLatestDraft"
    );
  }

  async gradingStatus(
    variables: GradingStatusVariables
  ): Promise<GradingStatusResponse> {
    return this.query<GradingStatusResponse, GradingStatusVariables>(
      "", // Query would be passed in
      variables,
      "AssignmentGradingStatus"
    );
  }

  async initiateAttempt(
    variables: InitiateAttemptVariables
  ): Promise<InitiateAttemptResponse> {
    return this.query<InitiateAttemptResponse, InitiateAttemptVariables>(
      "", // Query would be passed in
      variables,
      "Submission_StartAttempt"
    );
  }
}

/**
 * Create a GraphQL client instance for Coursera
 */
export function createCourseraClient(): GraphQLClient {
  return new GraphQLClient({
    baseUrl: "https://www.coursera.org/api/graphql",
    maxRetries: 3,
    retryDelay: 1000,
    timeout: 30000,
  });
}
