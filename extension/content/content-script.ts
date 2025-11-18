/**
 * Content Script
 * Runs on Coursera pages to detect courses and inject UI
 */

import {
  createMessage,
  createMessageHandler,
  sendToBackground,
  Message,
  MessageResponse,
  CourseDetectedMessage,
  UpdateProgressMessage,
} from "../utils/messages";
import {
  detectCourseInfo,
  isCourseraCoursePage,
  isActionableCourseItem,
  isModulePage,
  extractCSRFToken,
  extractAuthCookie,
  getCourseMetadata,
} from "../utils/course-detection";
import {
  getUserId,
  getVideoMetadata,
  getItemData,
  getCourseId,
  generateCsrfToken,
  markReadingComplete,
  getModuleData,
  ModuleData,
} from "../utils/coursera-api";
import { saveSessionToken } from "../utils/storage";

class ContentScript {
  private currentCourseInfo: any = null;
  private uiInjected = false;
  private floatingButton: HTMLElement | null = null;
  private progressModal: HTMLElement | null = null;

  constructor() {
    this.init();
  }

  private async init() {
    console.log("[Coursera Skipper] Content script loaded");
    console.log("[Coursera Skipper] URL:", window.location.href);
    console.log("[Coursera Skipper] Is course page:", isCourseraCoursePage());
    console.log(
      "[Coursera Skipper] Is actionable item:",
      isActionableCourseItem()
    );
    console.log("[Coursera Skipper] Is module page:", isModulePage());

    // Check if we're on a course page
    if (!isCourseraCoursePage()) {
      console.log("[Coursera Skipper] Not a course page, exiting");
      return;
    }

    // Extract and save session token
    await this.saveAuthInfo();

    // Detect course info
    this.detectAndNotify();

    // Watch for URL changes (SPA navigation)
    this.watchUrlChanges();

    // Set up message listener
    chrome.runtime.onMessage.addListener(
      createMessageHandler({
        UPDATE_PROGRESS: this.handleProgressUpdate.bind(this),
        PROGRESS_UPDATE: this.handleProgressUpdate.bind(this),
        LOG: this.handleLogMessage.bind(this),
        INJECT_UI: this.handleInjectUI.bind(this),
        ITEM_COMPLETED: this.handleItemCompleted.bind(this),
      })
    );

    // Inject UI on actionable item pages (including module overview)
    if (isActionableCourseItem()) {
      if (isModulePage()) {
        // Handle module page differently
        this.handleModulePage();
      } else {
        this.injectUI();
      }
    } else {
      console.log("[Coursera Skipper] Non-actionable page - no UI injected");
    }
  }

  private async saveAuthInfo() {
    try {
      // Extract auth cookie
      const authCookie = extractAuthCookie();
      if (authCookie) {
        await saveSessionToken(authCookie);
        console.log("[Coursera Skipper] Auth info saved");
      }

      // Also try to get CSRF token
      const csrfToken = extractCSRFToken();
      if (csrfToken) {
        console.log("[Coursera Skipper] CSRF token found");
      }
    } catch (error) {
      console.error("[Coursera Skipper] Failed to save auth info:", error);
    }
  }

  private detectAndNotify() {
    const courseInfo = detectCourseInfo();
    if (courseInfo) {
      this.currentCourseInfo = courseInfo;
      console.log("[Coursera Skipper] Course detected:", courseInfo);

      // Inject UI if not already injected and we're on an actionable item
      if (!this.uiInjected && isActionableCourseItem()) {
        this.injectUI();
      }

      // Notify background script
      const message = createMessage<CourseDetectedMessage>("COURSE_DETECTED", {
        courseId: courseInfo.courseId,
        itemId: courseInfo.itemId,
        itemType: courseInfo.itemType,
      });

      sendToBackground(message).catch((err) => {
        console.error("[Coursera Skipper] Failed to notify background:", err);
      });

      // Update UI if injected
      if (this.uiInjected) {
        this.updateFloatingButton();
      }
    }
  }

  private watchUrlChanges() {
    let lastUrl = window.location.href;

    const observer = new MutationObserver(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        console.log("[Coursera Skipper] URL changed:", currentUrl);
        this.detectAndNotify();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  private async injectUI() {
    if (this.uiInjected) return;

    // Wait for body to be ready
    if (!document.body) {
      setTimeout(() => this.injectUI(), 100);
      return;
    }

    this.createFloatingButton();

    // Check if inline logs should be shown
    const showInlineLogs = await chrome.storage.sync
      .get("settings")
      .then((result) => result.settings?.showInlineLogs ?? true);

    if (showInlineLogs) {
      this.createProgressModal();
    }

    this.uiInjected = true;

    console.log("[Coursera Skipper] UI injected");
  }

  private createFloatingButton() {
    const button = document.createElement("div");
    button.id = "coursera-skipper-button";
    button.className = "cs-floating-button";
    button.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 5v14l11-7z" fill="currentColor"/>
      </svg>
      <span>Skip</span>
    `;

    button.addEventListener("click", () => this.handleButtonClick());

    document.body.appendChild(button);
    this.floatingButton = button;
  }

  private createProgressModal() {
    const modal = document.createElement("div");
    modal.id = "coursera-skipper-modal";
    modal.className = "cs-progress-modal cs-hidden";
    modal.innerHTML = `
      <div class="cs-modal-content">
        <div class="cs-modal-header">
          <div class="cs-header-left">
            <h3>Coursera Skipper</h3>
            <span class="cs-status-badge cs-status-idle">Idle</span>
          </div>
          <div class="cs-header-actions">
            <button class="cs-minimize-btn" title="Minimize">−</button>
            <button class="cs-close-button" title="Close">&times;</button>
          </div>
        </div>
        <div class="cs-modal-body">
          <div class="cs-progress-section">
            <div class="cs-progress-info">
              <span class="cs-progress-percentage">0%</span>
              <span class="cs-progress-eta"></span>
            </div>
            <div class="cs-progress-bar">
              <div class="cs-progress-fill"></div>
            </div>
            <p class="cs-progress-message">Ready to start</p>
          </div>
          
          <div class="cs-logs-section">
            <div class="cs-logs-header">
              <h4>Live Logs</h4>
              <div class="cs-logs-controls">
                <select class="cs-log-filter">
                  <option value="all">All</option>
                  <option value="info">Info</option>
                  <option value="warn">Warn</option>
                  <option value="error">Error</option>
                </select>
                <button class="cs-toggle-logs" title="Toggle logs">▼</button>
              </div>
            </div>
            <div class="cs-logs-container"></div>
          </div>
        </div>
      </div>
    `;

    // Event listeners
    const closeButton = modal.querySelector(".cs-close-button");
    closeButton?.addEventListener("click", () => this.hideProgressModal());

    const minimizeBtn = modal.querySelector(".cs-minimize-btn");
    minimizeBtn?.addEventListener("click", () => this.toggleMinimize());

    const toggleLogsBtn = modal.querySelector(".cs-toggle-logs");
    toggleLogsBtn?.addEventListener("click", () => this.toggleLogs());

    const logFilter = modal.querySelector(
      ".cs-log-filter"
    ) as HTMLSelectElement;
    logFilter?.addEventListener("change", () =>
      this.filterLogs(logFilter.value)
    );

    document.body.appendChild(modal);
    this.progressModal = modal;
  }

  private toggleMinimize() {
    const modalContent = this.progressModal?.querySelector(".cs-modal-content");
    modalContent?.classList.toggle("cs-minimized");
  }

  private toggleLogs() {
    const logsContainer =
      this.progressModal?.querySelector(".cs-logs-container");
    const toggleBtn = this.progressModal?.querySelector(".cs-toggle-logs");

    logsContainer?.classList.toggle("cs-collapsed");
    if (toggleBtn) {
      toggleBtn.textContent = logsContainer?.classList.contains("cs-collapsed")
        ? "▶"
        : "▼";
    }
  }

  private filterLogs(level: string) {
    const logsContainer =
      this.progressModal?.querySelector(".cs-logs-container");
    if (!logsContainer) return;

    const logEntries = logsContainer.querySelectorAll(".cs-log-entry");
    logEntries.forEach((entry) => {
      if (level === "all") {
        (entry as HTMLElement).style.display = "";
      } else {
        const hasLevel = entry.classList.contains(`cs-log-${level}`);
        (entry as HTMLElement).style.display = hasLevel ? "" : "none";
      }
    });
  }

  private addLogToWidget(entry: any) {
    if (!this.progressModal) return;

    const logsContainer =
      this.progressModal.querySelector(".cs-logs-container");
    if (!logsContainer) return;

    const logEntry = document.createElement("div");
    logEntry.className = `cs-log-entry cs-log-${entry.level}`;

    const time = new Date(entry.timestamp).toLocaleTimeString();
    logEntry.innerHTML = `
      <span class="cs-log-time">${time}</span>
      <span class="cs-log-level">[${entry.level.toUpperCase()}]</span>
      <span class="cs-log-source">[${entry.source.toUpperCase()}]</span>
      <span class="cs-log-message">${this.escapeHtml(entry.message)}</span>
    `;

    logsContainer.appendChild(logEntry);

    // Auto-scroll to bottom
    logsContainer.scrollTop = logsContainer.scrollHeight;

    // Keep only last 50 logs
    while (logsContainer.children.length > 50) {
      logsContainer.removeChild(logsContainer.firstChild!);
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  private updateFloatingButton() {
    if (!this.floatingButton || !this.currentCourseInfo) return;

    const { itemType } = this.currentCourseInfo;
    let icon = "";
    let text = "";

    switch (itemType) {
      case "quiz":
        icon = "✓";
        text = "Solve Quiz";
        break;
      case "video":
        icon = "▶";
        text = "Watch Video";
        break;
      case "reading":
        icon = "📖";
        text = "Complete Reading";
        break;
      default:
        icon = "⚡";
        text = "Skip";
    }

    this.floatingButton.innerHTML = `
      <span class="cs-icon">${icon}</span>
      <span>${text}</span>
    `;
  }

  private async handleButtonClick() {
    if (!this.currentCourseInfo) {
      this.showError(
        "No course item detected. Please navigate to a specific item (video, quiz, or reading)."
      );
      return;
    }

    const { courseId, itemId, itemType } = this.currentCourseInfo;

    try {
      this.showProgressModal();
      this.updateProgress(0, "Starting...");

      if (itemType === "quiz" || itemType === "programming") {
        // Start solver
        const message = createMessage("START_SOLVER", {
          courseId,
          itemId,
          tabId: undefined,
        });

        const response = await sendToBackground(message);
        if (!response.success) {
          throw new Error(response.error || "Failed to start solver");
        }
      } else if (itemType === "video") {
        // Start watcher - fetch complete metadata first
        this.updateProgress(10, "Fetching video metadata...");

        const userId = await getUserId();
        if (!userId) {
          throw new Error(
            "Could not get user ID. Please ensure you're logged in."
          );
        }

        const fullCourseId = await getCourseId(courseId);
        if (!fullCourseId) {
          throw new Error("Could not get course ID");
        }

        const videoMetadata = await getVideoMetadata(fullCourseId, itemId);
        if (!videoMetadata) {
          throw new Error("Could not fetch video metadata");
        }

        const itemData = await getItemData(courseId, itemId);
        if (!itemData) {
          throw new Error("Could not fetch item data");
        }

        const csrfToken = extractCSRFToken() || generateCsrfToken();

        console.log("[Coursera Skipper] Prepared watcher data:", {
          slug: courseId,
          fullCourseId,
          itemId,
          userId,
          videoMetadata,
          itemData: {
            id: itemData.id,
            name: itemData.name,
            timeCommitment: itemData.timeCommitment,
          },
        });

        this.updateProgress(30, "Starting video watcher...");

        const message = createMessage("START_WATCHER", {
          metadata: videoMetadata,
          item: {
            id: itemData.id,
            name: itemData.name,
            timeCommitment: itemData.timeCommitment || 0,
          },
          slug: courseId,
          userId,
          courseId: fullCourseId,
          csrfToken,
        });

        console.log(
          "[Coursera Skipper] Sending START_WATCHER message to background..."
        );

        const response = await sendToBackground(message);
        console.log("[Coursera Skipper] Background response:", response);

        if (!response.success) {
          throw new Error(response.error || "Failed to start watcher");
        } else {
          console.log("[Coursera Skipper] Watcher started successfully!");
        }
      } else if (itemType === "reading") {
        // Mark reading as complete
        this.updateProgress(20, "Marking reading as complete...");

        const userId = await getUserId();
        if (!userId) {
          throw new Error(
            "Could not get user ID. Please ensure you're logged in."
          );
        }

        const fullCourseId = await getCourseId(courseId);
        if (!fullCourseId) {
          throw new Error("Could not get course ID");
        }

        const success = await markReadingComplete(fullCourseId, itemId, userId);
        if (success) {
          this.updateProgress(100, "Reading completed!");
          setTimeout(() => this.hideProgressModal(), 2000);
        } else {
          throw new Error("Failed to mark reading as complete");
        }
      } else {
        throw new Error(`Item type "${itemType}" is not supported yet`);
      }
    } catch (error: any) {
      console.error("[Coursera Skipper] Button click error:", error);
      console.error("[Coursera Skipper] Error stack:", error.stack);
      this.showError(error.message || "An error occurred");
      this.updateProgress(0, `Error: ${error.message}`);

      // Also log to background for centralized logging
      try {
        await sendToBackground(
          createMessage("LOG", {
            level: "error",
            message: `Button click error: ${error.message}`,
            data: { stack: error.stack, courseInfo: this.currentCourseInfo },
          })
        );
      } catch (logError) {
        // Ignore logging errors
      }
    }
  }

  private showProgressModal() {
    if (this.progressModal) {
      this.progressModal.classList.remove("cs-hidden");
    }
  }

  private hideProgressModal() {
    if (this.progressModal) {
      this.progressModal.classList.add("cs-hidden");
    }
  }

  private updateProgress(progress: number, message: string) {
    if (!this.progressModal) return;

    const progressFill = this.progressModal.querySelector(
      ".cs-progress-fill"
    ) as HTMLElement;
    const progressMessage = this.progressModal.querySelector(
      ".cs-progress-message"
    ) as HTMLElement;
    const progressPercentage = this.progressModal.querySelector(
      ".cs-progress-percentage"
    ) as HTMLElement;

    if (progressFill) {
      progressFill.style.width = `${progress}%`;
    }

    if (progressPercentage) {
      progressPercentage.textContent = `${Math.round(progress)}%`;
    }

    if (progressMessage) {
      progressMessage.textContent = message;
    }
  }

  private showError(message: string) {
    alert(`Coursera Skipper Error: ${message}`);
  }

  private async handleProgressUpdate(
    message: Message
  ): Promise<MessageResponse> {
    const msg = message as any;

    // Handle both UPDATE_PROGRESS and PROGRESS_UPDATE messages
    if (msg.type === "PROGRESS_UPDATE" && msg.data) {
      const { progress, currentStep, status, estimatedTimeRemaining } =
        msg.data;
      this.updateProgress(progress, currentStep);
      this.updateStatusBadge(status);

      if (estimatedTimeRemaining) {
        this.updateETA(estimatedTimeRemaining);
      }

      if (status === "completed") {
        setTimeout(() => {
          this.hideProgressModal();
        }, 3000);
      } else if (status === "error") {
        this.showError(currentStep);
      }
    } else {
      // Handle legacy UPDATE_PROGRESS
      this.updateProgress(msg.progress, msg.message);

      if (msg.status === "completed") {
        setTimeout(() => {
          this.hideProgressModal();
        }, 3000);
      } else if (msg.status === "error") {
        this.showError(msg.message);
      }
    }

    return { success: true };
  }

  private async handleLogMessage(message: Message): Promise<MessageResponse> {
    const msg = message as any;
    if (msg.entry) {
      this.addLogToWidget(msg.entry);
    }
    return { success: true };
  }

  private async handleItemCompleted(
    message: Message
  ): Promise<MessageResponse> {
    const msg = message as any;
    console.log("[Coursera Skipper] Item completed:", msg);

    // Hide progress modal
    this.hideProgressModal();

    // Show success message briefly before reload
    this.showSuccessMessage("Video completed! Reloading...");

    // Reload page after 1.5 seconds
    setTimeout(() => {
      window.location.reload();
    }, 1500);

    return { success: true };
  }

  private showSuccessMessage(message: string) {
    // Create a temporary success message
    const successDiv = document.createElement("div");
    successDiv.className = "cs-success-message";
    successDiv.textContent = message;
    successDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4caf50;
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 999999;
      font-family: sans-serif;
      font-size: 14px;
      font-weight: 500;
    `;
    document.body.appendChild(successDiv);

    // Remove after delay
    setTimeout(() => {
      successDiv.remove();
    }, 2000);
  }

  private updateStatusBadge(status: string) {
    const badge = this.progressModal?.querySelector(".cs-status-badge");
    if (!badge) return;

    badge.className = `cs-status-badge cs-status-${status}`;
    badge.textContent = status.charAt(0).toUpperCase() + status.slice(1);
  }

  private updateETA(seconds: number) {
    const etaElement = this.progressModal?.querySelector(".cs-progress-eta");
    if (!etaElement) return;

    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    etaElement.textContent = `~${minutes}m ${secs}s remaining`;
  }

  private async handleModulePage() {
    console.log("[Coursera Skipper] Module page detected");
    console.log("[Coursera Skipper] Current URL:", window.location.href);

    const courseInfo = detectCourseInfo();
    console.log("[Coursera Skipper] Course info:", courseInfo);

    if (!courseInfo || !courseInfo.moduleNumber) {
      console.error("[Coursera Skipper] Could not detect module number", {
        courseInfo,
        hasModuleNumber: courseInfo?.moduleNumber,
      });
      return;
    }

    // Create module skip UI
    this.injectModuleSkipUI(courseInfo.courseId, courseInfo.moduleNumber);

    // Fetch module data
    try {
      const moduleData = await getModuleData(
        courseInfo.courseId,
        courseInfo.moduleNumber
      );

      if (!moduleData) {
        console.error("[Coursera Skipper] Could not fetch module data");
        return;
      }

      console.log("[Coursera Skipper] Module data:", moduleData);

      // Update UI with module data
      this.updateModuleSkipUI(moduleData);
    } catch (error) {
      console.error("[Coursera Skipper] Error fetching module data:", error);
    }
  }

  private injectModuleSkipUI(courseId: string, moduleNumber: number) {
    // Remove existing UI if any
    const existing = document.querySelector(".cs-module-skip-widget");
    if (existing) {
      existing.remove();
    }

    // Create module skip widget
    const widget = document.createElement("div");
    widget.className = "cs-module-skip-widget";
    widget.innerHTML = `
      <div class="cs-module-skip-header">
        <h3>📚 Module ${moduleNumber} Skipper</h3>
        <button class="cs-module-close" title="Close">&times;</button>
      </div>
      <div class="cs-module-skip-body">
        <div class="cs-module-loading">
          <div class="cs-spinner"></div>
          <p>Loading module data...</p>
        </div>
        <div class="cs-module-stats" style="display: none;">
          <h4>Module Contents:</h4>
          <div class="cs-stats-grid">
            <div class="cs-stat-item">
              <span class="cs-stat-icon">📹</span>
              <span class="cs-stat-count" data-type="video">0</span>
              <span class="cs-stat-label">Videos</span>
            </div>
            <div class="cs-stat-item">
              <span class="cs-stat-icon">📖</span>
              <span class="cs-stat-count" data-type="reading">0</span>
              <span class="cs-stat-label">Readings</span>
            </div>
            <div class="cs-stat-item">
              <span class="cs-stat-icon">✍️</span>
              <span class="cs-stat-count" data-type="quiz">0</span>
              <span class="cs-stat-label">Quizzes</span>
            </div>
            <div class="cs-stat-item">
              <span class="cs-stat-icon">💻</span>
              <span class="cs-stat-count" data-type="programming">0</span>
              <span class="cs-stat-label">Programming</span>
            </div>
          </div>
          <button class="cs-module-skip-btn">
            <span class="cs-btn-icon">⚡</span>
            <span class="cs-btn-text">Skip All Items</span>
          </button>
          <p class="cs-module-note">This will automatically complete all items in this module</p>
        </div>
      </div>
    `;

    // Add styles
    const style = document.createElement("style");
    style.textContent = `
      .cs-module-skip-widget {
        position: fixed;
        top: 100px;
        right: 20px;
        width: 320px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        animation: slideIn 0.3s ease-out;
      }
      
      @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      
      .cs-module-skip-header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 16px 20px;
        border-radius: 12px 12px 0 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .cs-module-skip-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }
      
      .cs-module-close {
        background: rgba(255,255,255,0.2);
        border: none;
        color: white;
        font-size: 24px;
        cursor: pointer;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
      }
      
      .cs-module-close:hover {
        background: rgba(255,255,255,0.3);
      }
      
      .cs-module-skip-body {
        padding: 20px;
      }
      
      .cs-module-loading {
        text-align: center;
        padding: 20px;
      }
      
      .cs-spinner {
        width: 40px;
        height: 40px;
        border: 4px solid #f3f3f3;
        border-top: 4px solid #667eea;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 16px;
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      .cs-module-loading p {
        margin: 0;
        color: #666;
        font-size: 14px;
      }
      
      .cs-module-stats h4 {
        margin: 0 0 16px 0;
        font-size: 14px;
        font-weight: 600;
        color: #333;
      }
      
      .cs-stats-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-bottom: 20px;
      }
      
      .cs-stat-item {
        background: #f8f9fa;
        padding: 12px;
        border-radius: 8px;
        text-align: center;
      }
      
      .cs-stat-icon {
        font-size: 24px;
        display: block;
        margin-bottom: 4px;
      }
      
      .cs-stat-count {
        display: block;
        font-size: 20px;
        font-weight: 700;
        color: #667eea;
        margin-bottom: 2px;
      }
      
      .cs-stat-label {
        display: block;
        font-size: 12px;
        color: #666;
        font-weight: 500;
      }
      
      .cs-module-skip-btn {
        width: 100%;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        padding: 14px 20px;
        border-radius: 8px;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        transition: transform 0.2s, box-shadow 0.2s;
        margin-bottom: 12px;
      }
      
      .cs-module-skip-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
      }
      
      .cs-module-skip-btn:active {
        transform: translateY(0);
      }
      
      .cs-module-skip-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
      }
      
      .cs-btn-icon {
        font-size: 18px;
      }
      
      .cs-module-note {
        margin: 0;
        font-size: 12px;
        color: #666;
        text-align: center;
        line-height: 1.5;
      }
    `;
    document.head.appendChild(style);

    // Event listeners
    const closeBtn = widget.querySelector(".cs-module-close");
    closeBtn?.addEventListener("click", () => {
      widget.remove();
    });

    const skipBtn = widget.querySelector(".cs-module-skip-btn");
    skipBtn?.addEventListener("click", () => {
      this.startModuleSkip(courseId, moduleNumber);
    });

    document.body.appendChild(widget);
  }

  private updateModuleSkipUI(moduleData: ModuleData) {
    const widget = document.querySelector(".cs-module-skip-widget");
    if (!widget) return;

    const loading = widget.querySelector(".cs-module-loading") as HTMLElement;
    const stats = widget.querySelector(".cs-module-stats") as HTMLElement;

    // Hide loading, show stats
    if (loading) loading.style.display = "none";
    if (stats) stats.style.display = "block";

    // Update counts
    const videoCount = widget.querySelector(
      '[data-type="video"]'
    ) as HTMLElement;
    const readingCount = widget.querySelector(
      '[data-type="reading"]'
    ) as HTMLElement;
    const quizCount = widget.querySelector('[data-type="quiz"]') as HTMLElement;
    const programmingCount = widget.querySelector(
      '[data-type="programming"]'
    ) as HTMLElement;

    if (videoCount) videoCount.textContent = moduleData.counts.video.toString();
    if (readingCount)
      readingCount.textContent = moduleData.counts.reading.toString();
    if (quizCount) quizCount.textContent = moduleData.counts.quiz.toString();
    if (programmingCount)
      programmingCount.textContent = moduleData.counts.programming.toString();
  }

  private async startModuleSkip(courseSlug: string, moduleNumber: number) {
    console.log("[Coursera Skipper] Starting module skip", {
      courseSlug,
      moduleNumber,
    });

    // Disable button
    const widget = document.querySelector(".cs-module-skip-widget");
    const skipBtn = widget?.querySelector(
      ".cs-module-skip-btn"
    ) as HTMLButtonElement;
    if (skipBtn) {
      skipBtn.disabled = true;
      skipBtn.innerHTML = `
        <span class="cs-spinner" style="width: 18px; height: 18px; border-width: 2px;"></span>
        <span>Processing...</span>
      `;
    }

    try {
      // Get course ID
      const courseId = await getCourseId(courseSlug);
      if (!courseId) {
        throw new Error("Could not get course ID");
      }

      // Send message to background to start module skip
      const message = createMessage<any>("START_MODULE_SKIP", {
        courseId,
        courseSlug,
        moduleNumber,
      });

      const response = await sendToBackground(message);

      if (response.success) {
        console.log("[Coursera Skipper] Module skip started");

        // Show progress modal
        this.showProgressModal();
      } else {
        throw new Error(response.error || "Failed to start module skip");
      }
    } catch (error: any) {
      console.error("[Coursera Skipper] Error starting module skip:", error);
      alert("Failed to start module skip: " + error.message);

      // Re-enable button
      if (skipBtn) {
        skipBtn.disabled = false;
        skipBtn.innerHTML = `
          <span class="cs-btn-icon">⚡</span>
          <span class="cs-btn-text">Skip All Items</span>
        `;
      }
    }
  }

  private async handleInjectUI(message: Message): Promise<MessageResponse> {
    this.injectUI();
    return { success: true };
  }
}

// Initialize content script
new ContentScript();
