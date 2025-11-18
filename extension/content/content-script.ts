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
  extractCSRFToken,
  extractAuthCookie,
  getCourseMetadata,
} from "../utils/course-detection";
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

    // Check if we're on a course page
    if (!isCourseraCoursePage()) {
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
      })
    );

    // Inject UI
    this.injectUI();
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

  private injectUI() {
    if (this.uiInjected) return;

    // Wait for body to be ready
    if (!document.body) {
      setTimeout(() => this.injectUI(), 100);
      return;
    }

    this.createFloatingButton();
    this.createProgressModal();
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
      this.showError("No course detected. Please navigate to a course item.");
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
        // Start watcher
        const videoElement = document.querySelector("video");
        if (!videoElement) {
          throw new Error("Video element not found");
        }

        const message = createMessage("START_WATCHER", {
          videoUrl: window.location.href,
          duration: videoElement.duration || 0,
        });

        const response = await sendToBackground(message);
        if (!response.success) {
          throw new Error(response.error || "Failed to start watcher");
        }
      } else {
        throw new Error(`Item type "${itemType}" is not supported yet`);
      }
    } catch (error: any) {
      console.error("[Coursera Skipper] Error:", error);
      this.showError(error.message || "An error occurred");
      this.updateProgress(0, `Error: ${error.message}`);
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

  private async handleInjectUI(message: Message): Promise<MessageResponse> {
    this.injectUI();
    return { success: true };
  }
}

// Initialize content script
new ContentScript();
