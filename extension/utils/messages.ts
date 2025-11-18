/**
 * Message Passing Utility
 * Handles communication between content scripts, background, and popup
 */

export type MessageType =
  | "START_SOLVER"
  | "STOP_SOLVER"
  | "START_WATCHER"
  | "STOP_WATCHER"
  | "START_MODULE_SKIP"
  | "GET_STATUS"
  | "UPDATE_PROGRESS"
  | "PROGRESS_UPDATE"
  | "STATUS_CHANGED"
  | "OPERATION_STARTED"
  | "OPERATION_COMPLETED"
  | "ERROR"
  | "SETTINGS_CHANGED"
  | "LOG"
  | "COURSE_DETECTED"
  | "ITEM_COMPLETED"
  | "INJECT_UI";

export interface BaseMessage {
  type: MessageType;
  timestamp: number;
}

export interface StartSolverMessage extends BaseMessage {
  type: "START_SOLVER";
  courseId: string;
  itemId: string;
  attemptId?: string;
}

export interface StopSolverMessage extends BaseMessage {
  type: "STOP_SOLVER";
}

export interface StartWatcherMessage extends BaseMessage {
  type: "START_WATCHER";
  videoUrl: string;
  duration: number;
}

export interface StopWatcherMessage extends BaseMessage {
  type: "STOP_WATCHER";
}

export interface GetStatusMessage extends BaseMessage {
  type: "GET_STATUS";
}

export interface UpdateProgressMessage extends BaseMessage {
  type: "UPDATE_PROGRESS";
  progress: number;
  message: string;
  status: "idle" | "running" | "paused" | "completed" | "error";
}

export interface ProgressUpdateMessage extends BaseMessage {
  type: "PROGRESS_UPDATE";
  data: {
    taskId: string;
    operation: "solver" | "watcher";
    status: "idle" | "running" | "paused" | "completed" | "error";
    progress: number; // 0-100
    currentStep: string;
    totalSteps?: number;
    currentStepNumber?: number;
    estimatedTimeRemaining?: number; // seconds
  };
}

export interface StatusChangedMessage extends BaseMessage {
  type: "STATUS_CHANGED";
  status: "idle" | "running" | "paused" | "completed" | "error";
  details?: string;
}

export interface OperationStartedMessage extends BaseMessage {
  type: "OPERATION_STARTED";
  data: {
    operation: string;
    taskId: string;
    message?: string;
  };
}

export interface OperationCompletedMessage extends BaseMessage {
  type: "OPERATION_COMPLETED";
  data: {
    operation: string;
    taskId: string;
    success: boolean;
    message?: string;
    duration?: number; // ms
  };
}

export interface ErrorMessage extends BaseMessage {
  type: "ERROR";
  error: string;
  details?: any;
  category?: "authentication" | "network" | "api" | "configuration" | "unknown";
  recoverable?: boolean;
}

export interface SettingsChangedMessage extends BaseMessage {
  type: "SETTINGS_CHANGED";
}

export interface LogEntry {
  timestamp: number;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  source: "background" | "content" | "popup" | "solver" | "watcher" | "llm";
  data?: any;
  context?: {
    courseId?: string;
    itemId?: string;
    taskId?: string;
  };
}

export interface LogMessage extends BaseMessage {
  type: "LOG";
  entry: LogEntry;
}

export interface CourseDetectedMessage extends BaseMessage {
  type: "COURSE_DETECTED";
  courseId: string;
  itemId: string;
  itemType:
    | "quiz"
    | "video"
    | "reading"
    | "programming"
    | "peer-review"
    | "module"
    | "unknown";
}

export interface ItemCompletedMessage extends BaseMessage {
  type: "ITEM_COMPLETED";
  courseId: string;
  itemId: string;
  success: boolean;
}

export interface InjectUIMessage extends BaseMessage {
  type: "INJECT_UI";
}

export interface StartModuleSkipMessage extends BaseMessage {
  type: "START_MODULE_SKIP";
  courseId: string;
  courseSlug: string;
  moduleNumber: number;
}

export type Message =
  | StartSolverMessage
  | StopSolverMessage
  | StartWatcherMessage
  | StopWatcherMessage
  | StartModuleSkipMessage
  | GetStatusMessage
  | UpdateProgressMessage
  | ProgressUpdateMessage
  | StatusChangedMessage
  | OperationStartedMessage
  | OperationCompletedMessage
  | ErrorMessage
  | SettingsChangedMessage
  | LogMessage
  | CourseDetectedMessage
  | ItemCompletedMessage
  | InjectUIMessage;

export interface MessageResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Send a message to the background script
 */
export async function sendToBackground<T = any>(
  message: Message,
  timeout: number = 10000
): Promise<MessageResponse<T>> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error("Message timeout"));
    }, timeout);

    chrome.runtime.sendMessage(message, (response: MessageResponse<T>) => {
      clearTimeout(timeoutId);
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Send a message to a specific tab
 */
export async function sendToTab<T = any>(
  tabId: number,
  message: Message,
  timeout: number = 10000
): Promise<MessageResponse<T>> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error("Message timeout"));
    }, timeout);

    chrome.tabs.sendMessage(tabId, message, (response: MessageResponse<T>) => {
      clearTimeout(timeoutId);
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Send a message to all tabs
 */
export async function sendToAllTabs(message: Message): Promise<void> {
  const tabs = await chrome.tabs.query({});
  const promises = tabs.map(async (tab) => {
    if (tab.id) {
      try {
        await sendToTab(tab.id, message);
      } catch (error) {
        // Ignore errors for tabs that don't have content script
      }
    }
  });
  await Promise.all(promises);
}

/**
 * Create a message handler
 */
export function createMessageHandler(
  handlers: Partial<
    Record<
      MessageType,
      (
        message: Message,
        sender?: chrome.runtime.MessageSender
      ) => Promise<MessageResponse> | MessageResponse
    >
  >
): (
  message: Message,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: MessageResponse) => void
) => boolean {
  return (message, sender, sendResponse) => {
    const handler = handlers[message.type];
    if (handler) {
      Promise.resolve(handler(message, sender))
        .then((response) => sendResponse(response))
        .catch((error) => {
          sendResponse({
            success: false,
            error: error.message || "Unknown error",
          });
        });
      return true; // Keep the message channel open for async response
    }
    return false;
  };
}

/**
 * Create a message with timestamp
 */
export function createMessage<T extends Message>(
  type: T["type"],
  data: Omit<T, "type" | "timestamp">
): T {
  return {
    type,
    timestamp: Date.now(),
    ...data,
  } as T;
}
