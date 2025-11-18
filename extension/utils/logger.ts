/**
 * Logger Utility
 * Centralized logging with debug mode and log levels
 * Broadcasts logs to UI for real-time viewing
 */

import { getSetting } from "./storage";
import {
  createMessage,
  sendToAllTabs,
  type LogEntry as MessageLogEntry,
} from "./messages";

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  data?: any;
  context?: string;
}

type LogSource =
  | "background"
  | "content"
  | "popup"
  | "solver"
  | "watcher"
  | "llm";

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000;
  private debugMode = false;
  private source: LogSource = "background";

  constructor(source: LogSource = "background") {
    this.source = source;
    this.initDebugMode();
  }

  private async initDebugMode() {
    try {
      this.debugMode = await getSetting("debugMode");
    } catch (error) {
      this.debugMode = false;
    }
  }

  async setDebugMode(enabled: boolean) {
    this.debugMode = enabled;
  }

  setSource(source: LogSource) {
    this.source = source;
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.debugMode && level === LogLevel.DEBUG) {
      return false;
    }
    return true;
  }

  private log(level: LogLevel, message: string, data?: any, context?: string) {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      data,
      context,
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console output
    const prefix = context ? `[${context}]` : "";
    const logMessage = `${prefix} ${message}`;

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(logMessage, data);
        break;
      case LogLevel.INFO:
        console.log(logMessage, data);
        break;
      case LogLevel.WARN:
        console.warn(logMessage, data);
        break;
      case LogLevel.ERROR:
        console.error(logMessage, data);
        break;
    }

    // Broadcast to UI
    this.broadcastLog(level, message, data, context);

    // Store in local storage if debug mode
    if (this.debugMode) {
      this.persistLogs();
    }
  }

  private broadcastLog(
    level: LogLevel,
    message: string,
    data?: any,
    context?: string
  ) {
    try {
      const logEntry: MessageLogEntry = {
        timestamp: Date.now(),
        level: this.mapLogLevel(level),
        message,
        source: this.source,
        data,
        context: context ? { taskId: context } : undefined,
      };

      const logMessage = createMessage("LOG", { entry: logEntry });

      // Send to runtime (popup/options)
      chrome.runtime.sendMessage(logMessage).catch(() => {
        // Ignore if no listeners
      });

      // Send to all tabs
      sendToAllTabs(logMessage).catch(() => {
        // Ignore errors
      });
    } catch (error) {
      // Silently fail to avoid logging loops
    }
  }

  private mapLogLevel(level: LogLevel): "debug" | "info" | "warn" | "error" {
    switch (level) {
      case LogLevel.DEBUG:
        return "debug";
      case LogLevel.INFO:
        return "info";
      case LogLevel.WARN:
        return "warn";
      case LogLevel.ERROR:
        return "error";
      default:
        return "info";
    }
  }

  debug(message: string, data?: any, context?: string) {
    this.log(LogLevel.DEBUG, message, data, context);
  }

  info(message: string, data?: any, context?: string) {
    this.log(LogLevel.INFO, message, data, context);
  }

  warn(message: string, data?: any, context?: string) {
    this.log(LogLevel.WARN, message, data, context);
  }

  error(message: string, data?: any, context?: string) {
    this.log(LogLevel.ERROR, message, data, context);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs() {
    this.logs = [];
    chrome.storage.local.remove("logs");
  }

  private async persistLogs() {
    try {
      await chrome.storage.local.set({ logs: this.logs.slice(-100) });
    } catch (error) {
      console.error("Failed to persist logs:", error);
    }
  }

  async loadLogs() {
    try {
      const result = await chrome.storage.local.get("logs");
      if (result.logs) {
        this.logs = result.logs;
      }
    } catch (error) {
      console.error("Failed to load logs:", error);
    }
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

// Singleton instance
export const logger = new Logger();

// Convenience exports
export const debug = (message: string, data?: any, context?: string) =>
  logger.debug(message, data, context);
export const info = (message: string, data?: any, context?: string) =>
  logger.info(message, data, context);
export const warn = (message: string, data?: any, context?: string) =>
  logger.warn(message, data, context);
export const error = (message: string, data?: any, context?: string) =>
  logger.error(message, data, context);
