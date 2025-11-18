/**
 * Popup Script
 * Handles the extension popup UI and user interactions
 */

import { sendToBackground, createMessage } from "../utils/messages";
import { getSettings, saveSettings } from "../utils/storage";

interface LogEntry {
  timestamp: number;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  source: string;
  data?: any;
}

interface HistoryItem {
  timestamp: number;
  operation: string;
  success: boolean;
  message: string;
}

class PopupUI {
  private startBtn: HTMLButtonElement;
  private stopBtn: HTMLButtonElement;
  private statusBadge: HTMLElement;
  private courseInfo: HTMLElement;
  private progressSection: HTMLElement;
  private progressFill: HTMLElement;
  private progressPercentage: HTMLElement;
  private progressEta: HTMLElement;
  private progressMessage: HTMLElement;
  private errorSection: HTMLElement;
  private errorMessage: HTMLElement;
  private retryBtn: HTMLButtonElement;
  private dismissErrorBtn: HTMLButtonElement;
  private historySection: HTMLElement;
  private historyList: HTMLElement;
  private logsSection: HTMLElement;
  private logsContainer: HTMLElement;
  private logLevelFilter: HTMLSelectElement;
  private toggleLogsBtn: HTMLButtonElement;
  private autoSolveToggle: HTMLInputElement;
  private autoWatchToggle: HTMLInputElement;
  private optionsLink: HTMLAnchorElement;

  private logBuffer: LogEntry[] = [];
  private history: HistoryItem[] = [];
  private currentLogFilter: string = "all";
  private logsCollapsed: boolean = false;
  private readonly MAX_LOGS = 100;
  private readonly MAX_HISTORY = 10;

  constructor() {
    // Initialize all DOM elements
    this.startBtn = document.getElementById("start-btn") as HTMLButtonElement;
    this.stopBtn = document.getElementById("stop-btn") as HTMLButtonElement;
    this.statusBadge = document.getElementById("status-badge") as HTMLElement;
    this.courseInfo = document.getElementById("course-info") as HTMLElement;

    // Progress elements
    this.progressSection = document.getElementById(
      "progress-section"
    ) as HTMLElement;
    this.progressFill = document.getElementById("progress-fill") as HTMLElement;
    this.progressPercentage = document.getElementById(
      "progress-percentage"
    ) as HTMLElement;
    this.progressEta = document.getElementById("progress-eta") as HTMLElement;
    this.progressMessage = document.getElementById(
      "progress-message"
    ) as HTMLElement;

    // Error elements
    this.errorSection = document.getElementById("error-section") as HTMLElement;
    this.errorMessage = document.getElementById("error-message") as HTMLElement;
    this.retryBtn = document.getElementById("retry-btn") as HTMLButtonElement;
    this.dismissErrorBtn = document.getElementById(
      "dismiss-error-btn"
    ) as HTMLButtonElement;

    // History elements
    this.historySection = document.getElementById(
      "history-section"
    ) as HTMLElement;
    this.historyList = document.getElementById("history-list") as HTMLElement;

    // Logs elements
    this.logsSection = document.getElementById("logs-section") as HTMLElement;
    this.logsContainer = document.getElementById(
      "logs-container"
    ) as HTMLElement;
    this.logLevelFilter = document.getElementById(
      "log-level-filter"
    ) as HTMLSelectElement;
    this.toggleLogsBtn = document.getElementById(
      "toggle-logs-btn"
    ) as HTMLButtonElement;

    // Settings toggles
    this.autoSolveToggle = document.getElementById(
      "auto-solve-toggle"
    ) as HTMLInputElement;
    this.autoWatchToggle = document.getElementById(
      "auto-watch-toggle"
    ) as HTMLInputElement;
    this.optionsLink = document.getElementById(
      "options-link"
    ) as HTMLAnchorElement;

    this.init();
  }

  private async init() {
    // Load settings and data
    await this.loadSettings();
    await this.loadLogs();
    await this.loadHistory();

    // Set up event listeners
    this.setupEventListeners();

    // Set up message listener for real-time updates
    chrome.runtime.onMessage.addListener((message) => {
      this.handleMessage(message);
    });

    // Get current status
    await this.updateStatus();

    // Check current tab
    await this.checkCurrentTab();

    // Show sections if there's data
    if (this.logBuffer.length > 0) {
      this.logsSection.classList.remove("hidden");
    }
    if (this.history.length > 0) {
      this.historySection.classList.remove("hidden");
    }
  }

  private setupEventListeners() {
    // Main controls
    this.startBtn.addEventListener("click", () => this.handleStart());
    this.stopBtn.addEventListener("click", () => this.handleStop());

    // Settings
    this.autoSolveToggle.addEventListener("change", () =>
      this.handleToggleChange()
    );
    this.autoWatchToggle.addEventListener("change", () =>
      this.handleToggleChange()
    );
    this.optionsLink.addEventListener("click", (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });

    // Error handling
    this.retryBtn.addEventListener("click", () => this.handleRetry());
    this.dismissErrorBtn.addEventListener("click", () => this.hideError());

    // History
    const clearHistoryBtn = document.getElementById("clear-history-btn");
    clearHistoryBtn?.addEventListener("click", () => this.clearHistory());

    // Logs
    this.logLevelFilter.addEventListener("change", () => this.filterLogs());
    this.toggleLogsBtn.addEventListener("click", () => this.toggleLogs());

    const exportLogsBtn = document.getElementById("export-logs-btn");
    exportLogsBtn?.addEventListener("click", () => this.exportLogs());

    const clearLogsBtn = document.getElementById("clear-logs-btn");
    clearLogsBtn?.addEventListener("click", () => this.clearLogs());
  }

  private handleMessage(message: any) {
    switch (message.type) {
      case "PROGRESS_UPDATE":
        this.updateProgress(message.data);
        break;
      case "LOG":
        this.addLogEntry(message.entry);
        break;
      case "OPERATION_STARTED":
        this.handleOperationStarted(message.data);
        break;
      case "OPERATION_COMPLETED":
        this.handleOperationCompleted(message.data);
        break;
      case "ERROR":
        this.showError(message.error, message.details);
        break;
    }
  }

  private async loadSettings() {
    const settings = await getSettings();
    this.autoSolveToggle.checked = settings.autoSolve;
    this.autoWatchToggle.checked = settings.autoWatch;
  }

  private async handleToggleChange() {
    await saveSettings({
      autoSolve: this.autoSolveToggle.checked,
      autoWatch: this.autoWatchToggle.checked,
    });
  }

  private async handleStart() {
    try {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      const currentTab = tabs[0];

      if (!currentTab.id) {
        throw new Error("No active tab found");
      }

      // Send start message to content script
      const message = createMessage("START_SOLVER", {
        courseId: "",
        itemId: "",
        tabId: currentTab.id,
      });

      await sendToBackground(message);

      this.startBtn.disabled = true;
      this.stopBtn.disabled = false;
      this.setStatus("running", "Running");
    } catch (error: any) {
      console.error("Failed to start:", error);
      alert(`Error: ${error.message}`);
    }
  }

  private async handleStop() {
    try {
      const message = createMessage("STOP_SOLVER", {});
      await sendToBackground(message);

      this.startBtn.disabled = false;
      this.stopBtn.disabled = true;
      this.setStatus("idle", "Idle");
    } catch (error: any) {
      console.error("Failed to stop:", error);
      alert(`Error: ${error.message}`);
    }
  }

  private async updateStatus() {
    try {
      const message = createMessage("GET_STATUS", {});
      const response = await sendToBackground(message);

      if (response.success && response.data) {
        const { tasks, activeCount } = response.data;

        if (activeCount > 0) {
          this.setStatus("running", `Running (${activeCount})`);
          this.startBtn.disabled = true;
          this.stopBtn.disabled = false;

          // Show progress for first task
          if (tasks.length > 0) {
            const task = tasks[0];
            this.updateProgress(task);
          }
        } else {
          this.setStatus("idle", "Idle");
          this.startBtn.disabled = false;
          this.stopBtn.disabled = true;
          this.hideProgress();
        }
      }
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  }

  private async checkCurrentTab() {
    try {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      const currentTab = tabs[0];

      if (currentTab.url && currentTab.url.includes("coursera.org/learn/")) {
        this.courseInfo.innerHTML =
          '<p class="info-text">✓ Coursera course detected</p>';
        this.startBtn.disabled = false;
      } else {
        this.courseInfo.innerHTML =
          '<p class="info-text">Open a Coursera course to get started</p>';
        this.startBtn.disabled = true;
      }
    } catch (error) {
      console.error("Failed to check current tab:", error);
    }
  }

  private setStatus(type: "idle" | "running" | "error", text: string) {
    this.statusBadge.textContent = text;
    this.statusBadge.className = `status-badge status-${type}`;
  }

  // Progress management
  private updateProgress(data: any) {
    const { progress, currentStep, status, estimatedTimeRemaining } = data;

    this.progressSection.classList.remove("hidden");
    this.progressFill.style.width = `${progress}%`;
    this.progressFill.className = `progress-bar-fill status-${status}`;
    this.progressPercentage.textContent = `${Math.round(progress)}%`;
    this.progressMessage.textContent = currentStep || "Processing...";

    if (estimatedTimeRemaining) {
      const minutes = Math.floor(estimatedTimeRemaining / 60);
      const seconds = estimatedTimeRemaining % 60;
      this.progressEta.textContent = `~${minutes}m ${seconds}s remaining`;
    } else {
      this.progressEta.textContent = "";
    }
  }

  private hideProgress() {
    this.progressSection.classList.add("hidden");
  }

  // Error management
  private showError(message: string, details?: any) {
    this.errorSection.classList.remove("hidden");
    this.errorMessage.textContent = message;

    // Add to history
    this.addHistoryItem({
      timestamp: Date.now(),
      operation: "Error",
      success: false,
      message,
    });
  }

  private hideError() {
    this.errorSection.classList.add("hidden");
  }

  private handleRetry() {
    this.hideError();
    this.handleStart();
  }

  // History management
  private async loadHistory() {
    const result = await chrome.storage.local.get(["history"]);
    this.history = result.history || [];
    this.renderHistory();
  }

  private addHistoryItem(item: HistoryItem) {
    this.history.unshift(item);
    if (this.history.length > this.MAX_HISTORY) {
      this.history = this.history.slice(0, this.MAX_HISTORY);
    }
    chrome.storage.local.set({ history: this.history });
    this.renderHistory();
    this.historySection.classList.remove("hidden");
  }

  private renderHistory() {
    this.historyList.innerHTML = "";

    this.history.forEach((item) => {
      const div = document.createElement("div");
      div.className = "history-item";

      const icon = item.success ? "✓" : "✗";
      const iconClass = item.success ? "success" : "error";
      const time = new Date(item.timestamp).toLocaleTimeString();

      div.innerHTML = `
        <span class="history-icon ${iconClass}">${icon}</span>
        <div class="history-details">
          <div class="history-operation">${this.escapeHtml(
            item.operation
          )}</div>
          <div class="history-time">${time}</div>
        </div>
      `;

      this.historyList.appendChild(div);
    });
  }

  private clearHistory() {
    this.history = [];
    chrome.storage.local.set({ history: [] });
    this.historyList.innerHTML = "";
    this.historySection.classList.add("hidden");
  }

  private handleOperationStarted(data: any) {
    this.addHistoryItem({
      timestamp: Date.now(),
      operation: `Started: ${data.operation}`,
      success: true,
      message: data.message || "",
    });
  }

  private handleOperationCompleted(data: any) {
    this.addHistoryItem({
      timestamp: Date.now(),
      operation: `Completed: ${data.operation}`,
      success: data.success,
      message: data.message || "",
    });

    if (data.success) {
      this.hideProgress();
      this.setStatus("idle", "Idle");
    }
  }

  // Logging management
  private async loadLogs() {
    const result = await chrome.storage.local.get(["logs"]);
    this.logBuffer = result.logs || [];
    this.renderLogs();
  }

  private addLogEntry(entry: LogEntry) {
    this.logBuffer.push(entry);
    if (this.logBuffer.length > this.MAX_LOGS) {
      this.logBuffer.shift();
    }

    chrome.storage.local.set({ logs: this.logBuffer });

    if (this.shouldShowLog(entry)) {
      this.appendLogToUI(entry);
    }

    this.logsSection.classList.remove("hidden");
  }

  private shouldShowLog(entry: LogEntry): boolean {
    if (this.currentLogFilter === "all") return true;
    return entry.level === this.currentLogFilter;
  }

  private appendLogToUI(entry: LogEntry) {
    const div = this.createLogElement(entry);
    this.logsContainer.appendChild(div);

    // Auto-scroll to bottom
    this.logsContainer.scrollTop = this.logsContainer.scrollHeight;

    // Keep only recent entries in DOM
    while (this.logsContainer.children.length > this.MAX_LOGS) {
      this.logsContainer.removeChild(this.logsContainer.firstChild!);
    }
  }

  private createLogElement(entry: LogEntry): HTMLElement {
    const div = document.createElement("div");
    div.className = `log-entry log-${entry.level}`;

    const time = new Date(entry.timestamp).toLocaleTimeString();
    const source = entry.source.toUpperCase();

    div.innerHTML = `
      <span class="log-time">${time}</span>
      <span class="log-level">[${entry.level.toUpperCase()}]</span>
      <span class="log-source">[${source}]</span>
      <span class="log-message">${this.escapeHtml(entry.message)}</span>
      ${
        entry.data
          ? `<pre class="log-data">${this.escapeHtml(
              JSON.stringify(entry.data, null, 2)
            )}</pre>`
          : ""
      }
    `;

    return div;
  }

  private renderLogs() {
    this.logsContainer.innerHTML = "";
    this.logBuffer
      .filter((entry) => this.shouldShowLog(entry))
      .forEach((entry) => {
        this.logsContainer.appendChild(this.createLogElement(entry));
      });
  }

  private filterLogs() {
    this.currentLogFilter = this.logLevelFilter.value;
    this.renderLogs();
  }

  private toggleLogs() {
    this.logsCollapsed = !this.logsCollapsed;
    this.logsContainer.classList.toggle("collapsed", this.logsCollapsed);
    this.toggleLogsBtn.textContent = this.logsCollapsed ? "▶" : "▼";
  }

  private exportLogs() {
    const logsText = this.logBuffer
      .map((entry) => {
        const time = new Date(entry.timestamp).toISOString();
        const data = entry.data
          ? `\n${JSON.stringify(entry.data, null, 2)}`
          : "";
        return `[${time}] [${entry.level.toUpperCase()}] [${entry.source}] ${
          entry.message
        }${data}`;
      })
      .join("\n");

    navigator.clipboard
      .writeText(logsText)
      .then(() => {
        alert("Logs copied to clipboard!");
      })
      .catch(() => {
        // Fallback: download as file
        const blob = new Blob([logsText], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `coursera-skipper-logs-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
      });
  }

  private clearLogs() {
    this.logBuffer = [];
    chrome.storage.local.set({ logs: [] });
    this.logsContainer.innerHTML = "";
  }

  private escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize popup
document.addEventListener("DOMContentLoaded", () => {
  new PopupUI();
});
