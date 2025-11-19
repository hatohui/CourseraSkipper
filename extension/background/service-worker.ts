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
import { GradedLtiHandler } from "../../feats/gradedlti/graded-lti";
import {
  getModuleData,
  ModuleData,
  ModuleItemSummary,
  getUserId,
  markReadingComplete,
  getVideoMetadata,
  generateCsrfToken,
} from "../utils/coursera-api";
import { extractCSRFToken } from "../utils/course-detection";

interface ActiveTask {
  type: "solver" | "watcher" | "module";
  tabId: number;
  courseId: string;
  itemId: string;
  status: "running" | "paused" | "completed" | "error";
  progress: number;
  message: string;
  startTime: number;
  moduleData?: {
    moduleNumber: number;
    courseSlug: string;
    totalItems: number;
    completedItems: number;
  };
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
        START_GRADED_LTI: this.handleStartGradedLti.bind(this),
        START_MODULE_SKIP: this.handleStartModuleSkip.bind(this),
        START_ALL_MODULES_SKIP: this.handleStartAllModulesSkip.bind(this),
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

      // Update badge to show running
      this.updateBadge();

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

  private async handleStartGradedLti(
    message: Message,
    sender?: chrome.runtime.MessageSender
  ): Promise<MessageResponse> {
    const msg = message as any;
    const { courseId, itemId, userId } = msg;

    try {
      info("Starting graded LTI handler", { courseId, itemId, userId });

      if (!courseId || !itemId || !userId) {
        throw new Error("Missing required parameters for graded LTI");
      }

      // Create handler and complete the item
      const handler = new GradedLtiHandler({
        courseId,
        itemId,
        userId,
      });

      await handler.completeItem();

      info("Graded LTI completed", { itemId });

      return {
        success: true,
      };
    } catch (err: any) {
      error("Failed to complete graded LTI", err);
      return {
        success: false,
        error: err.message || "Failed to complete programming assignment",
      };
    }
  }

  private async handleStartModuleSkip(
    message: Message,
    sender?: chrome.runtime.MessageSender
  ): Promise<MessageResponse> {
    const msg = message as any;
    const { courseId, courseSlug, moduleNumber } = msg;

    try {
      // Get tab ID from sender
      const tabId = sender?.tab?.id || 0;

      info("Starting module skip", { courseId, courseSlug, moduleNumber });

      // Fetch module data
      const moduleData = await getModuleData(courseSlug, moduleNumber);
      if (!moduleData) {
        throw new Error("Could not fetch module data");
      }

      info("Module data fetched", {
        itemCount: moduleData.items.length,
        counts: moduleData.counts,
      });

      // Create task
      const taskKey = `module-${courseSlug}-${moduleNumber}`;
      const task: ActiveTask = {
        type: "module",
        tabId,
        courseId,
        itemId: `module-${moduleNumber}`,
        status: "running",
        progress: 0,
        message: "Starting module skip...",
        startTime: Date.now(),
        moduleData: {
          moduleNumber,
          courseSlug,
          totalItems: moduleData.items.length,
          completedItems: 0,
        },
      };
      this.activeTasks.set(taskKey, task);

      // Update badge
      this.updateBadge();

      // Process module items asynchronously
      this.processModuleItems(taskKey, courseSlug, courseId, moduleData).catch(
        (err) => {
          error("Module skip error", err);
          this.updateTaskStatus(taskKey, "error", err.message);
        }
      );

      return {
        success: true,
        data: { taskKey },
      };
    } catch (err: any) {
      error("Failed to start module skip", err);
      return {
        success: false,
        error: err.message || "Failed to start module skip",
      };
    }
  }

  private async handleStartAllModulesSkip(
    message: Message,
    sender?: chrome.runtime.MessageSender
  ): Promise<MessageResponse> {
    const msg = message as any;
    const { courseId, courseSlug, allModules } = msg;

    try {
      const tabId = sender?.tab?.id || 0;

      info("Starting all modules skip", {
        courseSlug,
        moduleCount: allModules?.length,
        tabId,
      });

      if (!courseId || !courseSlug || !allModules) {
        throw new Error("Missing required parameters");
      }

      const taskKey = `all-modules-${courseSlug}`;

      // Check if already running
      if (this.activeTasks.has(taskKey)) {
        return {
          success: false,
          error: "All modules skip already running",
        };
      }

      // Calculate total items
      const totalItems = allModules.reduce(
        (sum: number, m: ModuleData) => sum + m.counts.total,
        0
      );

      // Create task
      const task: ActiveTask = {
        type: "module",
        tabId,
        courseId,
        itemId: "all-modules",
        status: "running",
        progress: 0,
        message: "Starting all modules skip...",
        startTime: Date.now(),
        moduleData: {
          moduleNumber: 0,
          courseSlug,
          totalItems,
          completedItems: 0,
        },
      };
      this.activeTasks.set(taskKey, task);

      // Update badge
      this.updateBadge();

      // Process all modules asynchronously
      this.processAllModules(taskKey, courseSlug, courseId, allModules).catch(
        (err) => {
          error("All modules skip error", err);
          this.updateTaskStatus(taskKey, "error", err.message);
        }
      );

      return {
        success: true,
        data: { taskKey },
      };
    } catch (err: any) {
      error("Failed to start all modules skip", err);
      return {
        success: false,
        error: err.message || "Failed to start all modules skip",
      };
    }
  }

  private async processAllModules(
    taskKey: string,
    courseSlug: string,
    courseId: string,
    allModules: ModuleData[]
  ): Promise<void> {
    const task = this.activeTasks.get(taskKey);
    if (!task || !task.moduleData) return;

    try {
      // Get user ID
      const userId = await getUserId();
      if (!userId) {
        throw new Error("Could not get user ID");
      }

      const totalItems = task.moduleData.totalItems;
      let completedItems = 0;

      // Process each module
      for (let i = 0; i < allModules.length; i++) {
        const moduleData = allModules[i];

        this.updateTaskProgress(
          taskKey,
          Math.round((completedItems / totalItems) * 100),
          `Processing Module ${i + 1}/${allModules.length}: ${moduleData.name}`
        );

        // Process all items in this module concurrently
        const items = moduleData.items;

        // Separate by type
        const videos = items.filter((item) => item.type === "video");
        const readings = items.filter((item) => item.type === "reading");
        const programming = items.filter((item) => item.type === "programming");

        // Process videos
        if (videos.length > 0) {
          const videoPromises = videos.map(async (item) => {
            try {
              await this.processVideoItem(courseSlug, courseId, item, userId);
              completedItems++;
              if (task.moduleData) {
                task.moduleData.completedItems = completedItems;
              }
            } catch (err: any) {
              warn("Failed to process video", {
                itemId: item.id,
                error: err.message,
              });
            }
          });
          await Promise.allSettled(videoPromises);
        }

        // Process readings
        if (readings.length > 0) {
          const readingPromises = readings.map(async (item) => {
            try {
              await this.processReadingItem(courseId, item.id, userId);
              completedItems++;
              if (task.moduleData) {
                task.moduleData.completedItems = completedItems;
              }
            } catch (err: any) {
              warn("Failed to process reading", {
                itemId: item.id,
                error: err.message,
              });
            }
          });
          await Promise.allSettled(readingPromises);
        }

        // Process programming
        if (programming.length > 0) {
          const programmingPromises = programming.map(async (item) => {
            try {
              await this.processGradedLtiItem(courseId, item.id, userId);
              completedItems++;
              if (task.moduleData) {
                task.moduleData.completedItems = completedItems;
              }
            } catch (err: any) {
              warn("Failed to process programming", {
                itemId: item.id,
                error: err.message,
              });
            }
          });
          await Promise.allSettled(programmingPromises);
        }

        this.updateTaskProgress(
          taskKey,
          Math.round((completedItems / totalItems) * 100),
          `Completed Module ${i + 1}/${allModules.length}`
        );
      }

      // Mark as completed
      this.updateTaskStatus(
        taskKey,
        "completed",
        `All modules completed! Processed ${completedItems}/${totalItems} items`
      );

      info("All modules skip completed", {
        taskKey,
        completedItems,
        totalItems,
      });

      // Notify content script
      if (task.tabId && task.tabId > 0) {
        const completionMsg = createMessage("ITEM_COMPLETED", {
          courseId: task.courseId,
          itemId: task.itemId,
          success: true,
        });
        sendToTab(task.tabId, completionMsg).catch(() => {
          // Ignore if tab is closed
        });
      }

      // Show completion notification
      try {
        await showCompletionNotification("module");
      } catch (notifErr) {
        // Ignore notification errors
      }
    } catch (err: any) {
      error("All modules processing failed", err);
      this.updateTaskStatus(taskKey, "error", err.message);

      try {
        await showErrorNotification("All modules skip failed", err.message);
      } catch (notifErr) {
        // Ignore notification errors
      }
    }
  }

  private async processModuleItems(
    taskKey: string,
    courseSlug: string,
    courseId: string,
    moduleData: ModuleData
  ): Promise<void> {
    const task = this.activeTasks.get(taskKey);
    if (!task || !task.moduleData) return;

    try {
      // Get user ID
      const userId = await getUserId();
      if (!userId) {
        throw new Error("Could not get user ID");
      }

      const items = moduleData.items;
      let completedCount = 0;

      // Separate items by type for concurrent processing
      const videos = items.filter((item) => item.type === "video");
      const readings = items.filter((item) => item.type === "reading");
      const quizzes = items.filter((item) => item.type === "quiz");
      const programming = items.filter((item) => item.type === "programming");

      const totalItems = items.length;

      // Process videos concurrently
      if (videos.length > 0) {
        this.updateTaskProgress(
          taskKey,
          10,
          `Processing ${videos.length} videos concurrently...`
        );

        const videoPromises = videos.map(async (item) => {
          try {
            await this.processVideoItem(courseSlug, courseId, item, userId);
            completedCount++;
            if (task.moduleData) {
              task.moduleData.completedItems = completedCount;
            }
            const progress = Math.round((completedCount / totalItems) * 100);
            this.updateTaskProgress(
              taskKey,
              progress,
              `Completed video: ${item.name} (${completedCount}/${totalItems})`
            );
          } catch (itemError: any) {
            warn("Failed to process video", {
              itemId: item.id,
              error: itemError.message,
            });
          }
        });

        await Promise.allSettled(videoPromises);
        info("All videos processed", { count: videos.length });
      }

      // Process readings concurrently
      if (readings.length > 0) {
        this.updateTaskProgress(
          taskKey,
          Math.round((completedCount / totalItems) * 100),
          `Processing ${readings.length} readings concurrently...`
        );

        const readingPromises = readings.map(async (item) => {
          try {
            await this.processReadingItem(courseId, item.id, userId);
            completedCount++;
            if (task.moduleData) {
              task.moduleData.completedItems = completedCount;
            }
            const progress = Math.round((completedCount / totalItems) * 100);
            this.updateTaskProgress(
              taskKey,
              progress,
              `Completed reading: ${item.name} (${completedCount}/${totalItems})`
            );
          } catch (itemError: any) {
            warn("Failed to process reading", {
              itemId: item.id,
              error: itemError.message,
            });
          }
        });

        await Promise.allSettled(readingPromises);
        info("All readings processed", { count: readings.length });
      }

      // Process programming assignments (graded LTI) concurrently
      if (programming.length > 0) {
        this.updateTaskProgress(
          taskKey,
          Math.round((completedCount / totalItems) * 100),
          `Processing ${programming.length} programming assignments concurrently...`
        );

        const programmingPromises = programming.map(async (item) => {
          try {
            await this.processGradedLtiItem(courseId, item.id, userId);
            completedCount++;
            if (task.moduleData) {
              task.moduleData.completedItems = completedCount;
            }
            const progress = Math.round((completedCount / totalItems) * 100);
            this.updateTaskProgress(
              taskKey,
              progress,
              `Completed programming: ${item.name} (${completedCount}/${totalItems})`
            );
          } catch (itemError: any) {
            warn("Failed to process programming assignment", {
              itemId: item.id,
              error: itemError.message,
            });
          }
        });

        await Promise.allSettled(programmingPromises);
        info("All programming assignments processed", {
          count: programming.length,
        });
      }

      // Log quizzes (not yet implemented)
      if (quizzes.length > 0) {
        info("Quiz items detected, skipping for now", {
          count: quizzes.length,
        });
      }

      // Mark as completed
      this.updateTaskStatus(
        taskKey,
        "completed",
        `Module completed! Processed ${completedCount}/${items.length} items`
      );

      info("Module skip completed", {
        taskKey,
        completedCount,
        totalCount: items.length,
      });

      // Notify content script to reload page
      if (task.tabId && task.tabId > 0) {
        const completionMsg = createMessage("ITEM_COMPLETED", {
          courseId: task.courseId,
          itemId: task.itemId,
          success: true,
        });
        sendToTab(task.tabId, completionMsg).catch(() => {
          // Ignore if tab is closed
        });
      }

      // Show completion notification
      try {
        await showCompletionNotification("module");
      } catch (notifErr) {
        // Ignore notification errors
      }
    } catch (err: any) {
      error("Module processing failed", err);
      this.updateTaskStatus(taskKey, "error", err.message);

      try {
        await showErrorNotification("Module skip failed", err.message);
      } catch (notifErr) {
        // Ignore notification errors
      }
    }
  }

  private async processVideoItem(
    courseSlug: string,
    courseId: string,
    item: { id: string; name: string; timeCommitment: number },
    userId: string
  ): Promise<void> {
    info("Processing video item", {
      itemId: item.id,
      name: item.name,
      timeCommitment: item.timeCommitment,
    });

    // Get video metadata - needs full courseId, not slug
    const metadata = await getVideoMetadata(courseId, item.id);
    if (!metadata) {
      throw new Error("Could not get video metadata");
    }

    // Create watcher and run it
    const watcher = new Watcher({
      metadata,
      item: {
        id: item.id,
        name: item.name,
        timeCommitment: item.timeCommitment,
      },
      slug: courseSlug,
      userId,
      courseId,
      csrfToken: generateCsrfToken(),
    });

    await watcher.watchItem();
    info("Video item completed", { itemId: item.id });
  }

  private async processReadingItem(
    courseId: string,
    itemId: string,
    userId: string
  ): Promise<void> {
    info("Processing reading item", { itemId });

    const success = await markReadingComplete(courseId, itemId, userId);
    if (!success) {
      throw new Error("Failed to mark reading as complete");
    }

    info("Reading item completed", { itemId });
  }

  private async processGradedLtiItem(
    courseId: string,
    itemId: string,
    userId: string
  ): Promise<void> {
    info("Processing graded LTI item (programming assignment)", { itemId });

    const handler = new GradedLtiHandler({
      courseId,
      itemId,
      userId,
    });

    await handler.completeItem();
    info("Graded LTI item completed", { itemId });
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

    // Update badge
    this.updateBadge();

    if (status === "completed" || status === "error") {
      // Remove task after delay
      setTimeout(() => {
        this.activeTasks.delete(taskKey);
        this.solvers.delete(taskKey);
        this.watchers.delete(taskKey);
        this.updateBadge();
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
      this.updateBadge();
    }
  }

  private updateBadge() {
    const runningTasks = Array.from(this.activeTasks.values()).filter(
      (t) => t.status === "running"
    );

    if (runningTasks.length > 0) {
      chrome.action.setBadgeText({ text: runningTasks.length.toString() });
      chrome.action.setBadgeBackgroundColor({ color: "#4CAF50" });
    } else {
      chrome.action.setBadgeText({ text: "" });
    }
  }
}

// Initialize the background service
new BackgroundService();
