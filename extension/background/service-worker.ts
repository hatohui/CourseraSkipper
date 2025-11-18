/**
 * Background Service Worker
 * Handles extension lifecycle, message routing, and state management
 */

import {
  createMessageHandler,
  Message,
  MessageResponse,
  sendToTab,
  createMessage,
  UpdateProgressMessage,
} from "../utils/messages";
import {
  getSettings,
  saveCourseProgress,
  getSessionToken,
} from "../utils/storage";
import { logger, info, error, warn } from "../utils/logger";
import {
  showCompletionNotification,
  showErrorNotification,
} from "../utils/notifications";
import { GradedSolver } from "../../feats/assetments/solver";
import { Watcher } from "../../feats/watcher/watcher";
import { GraphQLClient } from "../../feats/assetments/graphql-client";

interface ActiveTask {
  type: "solver" | "watcher";
  tabId: number;
  courseId: string;
  itemId: string;
  status: "running" | "paused" | "completed" | "error";
  progress: number;
  message: string;
  startTime: number;
}

class BackgroundService {
  private activeTasks: Map<string, ActiveTask> = new Map();
  private solvers: Map<string, GradedSolver> = new Map();
  private watchers: Map<string, Watcher> = new Map();

  constructor() {
    this.init();
  }

  private async init() {
    info("Background service worker initialized");
    await logger.loadLogs();

    // Set up message listener
    chrome.runtime.onMessage.addListener(
      createMessageHandler({
        START_SOLVER: this.handleStartSolver.bind(this),
        STOP_SOLVER: this.handleStopSolver.bind(this),
        START_WATCHER: this.handleStartWatcher.bind(this),
        STOP_WATCHER: this.handleStopWatcher.bind(this),
        GET_STATUS: this.handleGetStatus.bind(this),
        COURSE_DETECTED: this.handleCourseDetected.bind(this),
        LOG: this.handleLog.bind(this),
      })
    );

    // Handle installation
    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === "install") {
        info("Extension installed");
        chrome.tabs.create({
          url: chrome.runtime.getURL("options/options.html"),
        });
      } else if (details.reason === "update") {
        info(
          "Extension updated to version " + chrome.runtime.getManifest().version
        );
      }
    });

    // Handle tab removal
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.cleanupTasksForTab(tabId);
    });
  }

  private async handleStartSolver(message: Message): Promise<MessageResponse> {
    const msg = message as any;
    const { courseId, itemId, attemptId } = msg;
    const tabId = msg.tabId;

    try {
      info("Starting solver", { courseId, itemId, attemptId });

      // Check if already running
      const taskKey = `${courseId}-${itemId}`;
      if (this.activeTasks.has(taskKey)) {
        return {
          success: false,
          error: "Solver already running for this item",
        };
      }

      // Get settings and validate
      const settings = await getSettings();
      if (!settings.apiKey) {
        return {
          success: false,
          error: "API key not configured. Please set it in the options page.",
        };
      }

      // Get session token
      const sessionToken = await getSessionToken();
      if (!sessionToken) {
        return {
          success: false,
          error: "Not authenticated. Please log in to Coursera.",
        };
      }

      // Create GraphQL client
      const client = new GraphQLClient({
        baseUrl: "https://www.coursera.org/api/graphql",
      });

      // Create solver
      const solver = new GradedSolver({
        courseId,
        itemId,
        client,
      });

      // Store solver
      this.solvers.set(taskKey, solver);

      // Create task
      const task: ActiveTask = {
        type: "solver",
        tabId,
        courseId,
        itemId,
        status: "running",
        progress: 0,
        message: "Starting solver...",
        startTime: Date.now(),
      };
      this.activeTasks.set(taskKey, task);

      // Run solver asynchronously
      this.runSolver(taskKey, solver, attemptId).catch((err) => {
        error("Solver error", err);
        this.updateTaskStatus(taskKey, "error", err.message);
      });

      return {
        success: true,
        data: { taskKey },
      };
    } catch (err: any) {
      error("Failed to start solver", err);
      return {
        success: false,
        error: err.message || "Failed to start solver",
      };
    }
  }

  private async runSolver(
    taskKey: string,
    solver: GradedSolver,
    attemptId?: string
  ): Promise<void> {
    try {
      const task = this.activeTasks.get(taskKey);
      if (!task) return;

      // Update progress callback
      const onProgress = (progress: number, message: string) => {
        this.updateTaskProgress(taskKey, progress, message);
      };

      // Run the solver
      // TODO: LLM connector needs to be properly configured
      await solver.solve(null);

      // Mark as completed
      this.updateTaskStatus(
        taskKey,
        "completed",
        "Assessment completed successfully"
      );

      // Save progress
      await saveCourseProgress({
        courseId: task.courseId,
        itemId: task.itemId,
        status: "completed",
        timestamp: Date.now(),
      });

      info("Solver completed", { taskKey });

      // Show completion notification (don't fail if this errors)
      try {
        await showCompletionNotification("assessment");
      } catch (notifErr) {
        // Ignore notification errors
      }
    } catch (err: any) {
      error("Solver failed", err);
      this.updateTaskStatus(taskKey, "error", err.message);

      // Show error notification (don't fail if this errors)
      try {
        await showErrorNotification("Solver failed", err.message);
      } catch (notifErr) {
        // Ignore notification errors
      }

      const task = this.activeTasks.get(taskKey);
      if (task) {
        await saveCourseProgress({
          courseId: task.courseId,
          itemId: task.itemId,
          status: "failed",
          timestamp: Date.now(),
          error: err.message,
        });
      }
    }
  }

  private async handleStopSolver(message: Message): Promise<MessageResponse> {
    const msg = message as any;
    const { courseId, itemId } = msg;

    try {
      const taskKey = `${courseId}-${itemId}`;
      const task = this.activeTasks.get(taskKey);

      if (!task) {
        return {
          success: false,
          error: "No active solver found",
        };
      }

      // Stop the solver
      const solver = this.solvers.get(taskKey);
      if (solver) {
        // Solvers don't have a stop method, so we just clean up
        this.solvers.delete(taskKey);
      }

      // Update task status
      this.updateTaskStatus(taskKey, "paused", "Solver stopped by user");

      info("Solver stopped", { taskKey });

      return {
        success: true,
      };
    } catch (err: any) {
      error("Failed to stop solver", err);
      return {
        success: false,
        error: err.message || "Failed to stop solver",
      };
    }
  }

  private async handleStartWatcher(
    message: Message,
    sender?: chrome.runtime.MessageSender
  ): Promise<MessageResponse> {
    const msg = message as any;
    const { metadata, item, slug, userId, courseId, csrfToken } = msg;

    try {
      // Get tab ID from sender
      const tabId = sender?.tab?.id || 0;

      info("Starting watcher", { item: item?.name, courseId, tabId });

      // Validate required parameters
      if (!metadata || !item || !slug || !userId || !courseId) {
        throw new Error("Missing required watcher parameters");
      }

      // Create watcher with proper config
      const watcher = new Watcher({
        metadata,
        item,
        slug,
        userId,
        courseId,
        csrfToken,
      });

      // Store watcher
      const taskKey = `watcher-${courseId}-${item.id}`;
      this.watchers.set(taskKey, watcher);

      // Create task with tab ID from sender
      const task: ActiveTask = {
        type: "watcher",
        tabId: tabId,
        courseId,
        itemId: item.id,
        status: "running",
        progress: 0,
        message: "Starting video watcher...",
        startTime: Date.now(),
      };
      this.activeTasks.set(taskKey, task);

      // Run watcher asynchronously
      this.runWatcher(taskKey, watcher).catch((err) => {
        error("Watcher error", err);
      });

      return {
        success: true,
        data: { taskKey },
      };
    } catch (err: any) {
      error("Failed to start watcher", err);
      return {
        success: false,
        error: err.message || "Failed to start watcher",
      };
    }
  }

  private async runWatcher(taskKey: string, watcher: Watcher): Promise<void> {
    try {
      this.updateTaskProgress(taskKey, 50, "Watching video...");

      await watcher.watchItem();

      info("Watcher completed", { taskKey });

      // Mark as completed
      this.updateTaskStatus(
        taskKey,
        "completed",
        "Video completed successfully"
      );
      
      // Notify content script of completion
      const task = this.activeTasks.get(taskKey);
      if (task && task.tabId) {
        const completionMsg = createMessage("ITEM_COMPLETED", {
          courseId: task.courseId,
          itemId: task.itemId,
          success: true,
        });
        sendToTab(task.tabId, completionMsg).catch(() => {
          // Ignore if tab is closed
        });
      }

      // Show completion notification (don't fail if this errors)
      try {
        await showCompletionNotification("video");
      } catch (notifErr) {
        // Ignore notification errors
      }
    } catch (err: any) {
      error("Watcher failed", err);

      this.updateTaskStatus(taskKey, "error", err.message);

      // Show error notification (don't fail if this errors)
      try {
        await showErrorNotification("Watcher failed", err.message);
      } catch (notifErr) {
        // Ignore notification errors
      }
    } finally {
      this.watchers.delete(taskKey);
    }
  }

  private async handleStopWatcher(message: Message): Promise<MessageResponse> {
    // Stop all watchers
    this.watchers.clear();
    return { success: true };
  }

  private async handleGetStatus(message: Message): Promise<MessageResponse> {
    const tasks = Array.from(this.activeTasks.values());
    return {
      success: true,
      data: {
        tasks,
        activeCount: tasks.filter((t) => t.status === "running").length,
      },
    };
  }

  private async handleCourseDetected(
    message: Message
  ): Promise<MessageResponse> {
    const msg = message as any;
    info("Course detected", msg);
    return { success: true };
  }

  private async handleLog(message: Message): Promise<MessageResponse> {
    const msg = message as any;
    const { level, message: logMessage, data } = msg;

    switch (level) {
      case "debug":
        logger.debug(logMessage, data, "ContentScript");
        break;
      case "info":
        logger.info(logMessage, data, "ContentScript");
        break;
      case "warn":
        logger.warn(logMessage, data, "ContentScript");
        break;
      case "error":
        logger.error(logMessage, data, "ContentScript");
        break;
    }

    return { success: true };
  }

  private updateTaskProgress(
    taskKey: string,
    progress: number,
    message: string
  ) {
    const task = this.activeTasks.get(taskKey);
    if (!task) return;

    task.progress = progress;
    task.message = message;

    // Only notify tab if we have a valid tab ID
    if (task.tabId && task.tabId > 0) {
      const progressMessage = createMessage<UpdateProgressMessage>(
        "UPDATE_PROGRESS",
        {
          progress,
          message,
          status: task.status,
        }
      );

      sendToTab(task.tabId, progressMessage).catch(() => {
        // Silently ignore messaging errors - tab might have closed
      });
    }
  }

  private updateTaskStatus(
    taskKey: string,
    status: ActiveTask["status"],
    message: string
  ) {
    const task = this.activeTasks.get(taskKey);
    if (!task) return;

    task.status = status;
    task.message = message;

    if (status === "completed" || status === "error") {
      // Remove task after delay
      setTimeout(() => {
        this.activeTasks.delete(taskKey);
        this.solvers.delete(taskKey);
        this.watchers.delete(taskKey);
      }, 60000); // Keep for 1 minute
    }

    // Notify tab
    const progressMessage = createMessage<UpdateProgressMessage>(
      "UPDATE_PROGRESS",
      {
        progress: task.progress,
        message,
        status,
      }
    );

    // Only send if we have a valid tab ID
    if (task.tabId && task.tabId > 0) {
      sendToTab(task.tabId, progressMessage).catch(() => {
        // Silently ignore - tab might have closed
      });
    }
  }

  private cleanupTasksForTab(tabId: number) {
    const toRemove: string[] = [];
    this.activeTasks.forEach((task, key) => {
      if (task.tabId === tabId) {
        toRemove.push(key);
      }
    });

    toRemove.forEach((key) => {
      this.activeTasks.delete(key);
      this.solvers.delete(key);
      this.watchers.delete(key);
    });

    if (toRemove.length > 0) {
      info("Cleaned up tasks for closed tab", {
        tabId,
        count: toRemove.length,
      });
    }
  }
}

// Initialize the background service
new BackgroundService();
