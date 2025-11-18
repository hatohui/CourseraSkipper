/**
 * Options Page Script
 * Handles settings configuration and management
 */

import {
  getSettings,
  saveSettings,
  clearAllStorage,
  exportSettings,
  importSettings,
  validateSettings,
} from "../utils/storage";
import { logger } from "../utils/logger";

class OptionsUI {
  private providerSelect: HTMLSelectElement;
  private apiKeyInput: HTMLInputElement;
  private modelInput: HTMLInputElement;
  private temperatureInput: HTMLInputElement;
  private autoSolveToggle: HTMLInputElement;
  private autoWatchToggle: HTMLInputElement;
  private debugModeToggle: HTMLInputElement;
  private delayInput: HTMLInputElement;
  private maxRetriesInput: HTMLInputElement;
  // UI/UX preferences
  private showNotificationsToggle: HTMLInputElement;
  private verboseProgressToggle: HTMLInputElement;
  private showInlineLogsToggle: HTMLInputElement;
  private playSoundToggle: HTMLInputElement;
  private logLevelSelect: HTMLSelectElement;
  // Buttons
  private saveBtn: HTMLButtonElement;
  private cancelBtn: HTMLButtonElement;
  private exportBtn: HTMLButtonElement;
  private importBtn: HTMLButtonElement;
  private clearLogsBtn: HTMLButtonElement;
  private resetAllBtn: HTMLButtonElement;
  private statusMessage: HTMLElement;

  constructor() {
    this.providerSelect = document.getElementById(
      "provider"
    ) as HTMLSelectElement;
    this.apiKeyInput = document.getElementById("api-key") as HTMLInputElement;
    this.modelInput = document.getElementById("model") as HTMLInputElement;
    this.temperatureInput = document.getElementById(
      "temperature"
    ) as HTMLInputElement;
    this.autoSolveToggle = document.getElementById(
      "auto-solve"
    ) as HTMLInputElement;
    this.autoWatchToggle = document.getElementById(
      "auto-watch"
    ) as HTMLInputElement;
    this.debugModeToggle = document.getElementById(
      "debug-mode"
    ) as HTMLInputElement;
    this.delayInput = document.getElementById("delay") as HTMLInputElement;
    this.maxRetriesInput = document.getElementById(
      "max-retries"
    ) as HTMLInputElement;
    // UI/UX preferences
    this.showNotificationsToggle = document.getElementById(
      "show-notifications"
    ) as HTMLInputElement;
    this.verboseProgressToggle = document.getElementById(
      "verbose-progress"
    ) as HTMLInputElement;
    this.showInlineLogsToggle = document.getElementById(
      "show-inline-logs"
    ) as HTMLInputElement;
    this.playSoundToggle = document.getElementById(
      "play-sound"
    ) as HTMLInputElement;
    this.logLevelSelect = document.getElementById(
      "log-level"
    ) as HTMLSelectElement;
    // Buttons
    this.saveBtn = document.getElementById("save-btn") as HTMLButtonElement;
    this.cancelBtn = document.getElementById("cancel-btn") as HTMLButtonElement;
    this.exportBtn = document.getElementById(
      "export-settings"
    ) as HTMLButtonElement;
    this.importBtn = document.getElementById(
      "import-settings"
    ) as HTMLButtonElement;
    this.clearLogsBtn = document.getElementById(
      "clear-logs"
    ) as HTMLButtonElement;
    this.resetAllBtn = document.getElementById(
      "reset-all"
    ) as HTMLButtonElement;
    this.statusMessage = document.getElementById(
      "status-message"
    ) as HTMLElement;

    this.init();
  }

  private async init() {
    // Load current settings
    await this.loadSettings();

    // Set up event listeners
    this.saveBtn.addEventListener("click", () => this.handleSave());
    this.cancelBtn.addEventListener("click", () => this.loadSettings());
    this.exportBtn.addEventListener("click", () => this.handleExport());
    this.importBtn.addEventListener("click", () => this.handleImport());
    this.clearLogsBtn.addEventListener("click", () => this.handleClearLogs());
    this.resetAllBtn.addEventListener("click", () => this.handleResetAll());
  }

  private async loadSettings() {
    const settings = await getSettings();

    this.providerSelect.value = settings.provider;
    this.apiKeyInput.value = settings.apiKey;
    this.modelInput.value = settings.model;
    this.temperatureInput.value = settings.temperature.toString();
    this.autoSolveToggle.checked = settings.autoSolve;
    this.autoWatchToggle.checked = settings.autoWatch;
    this.debugModeToggle.checked = settings.debugMode;
    this.delayInput.value = settings.delayBetweenQuestions.toString();
    this.maxRetriesInput.value = settings.maxRetries.toString();
    // UI/UX preferences
    this.showNotificationsToggle.checked = settings.showNotifications;
    this.verboseProgressToggle.checked = settings.verboseProgress;
    this.showInlineLogsToggle.checked = settings.showInlineLogs;
    this.playSoundToggle.checked = settings.playSound;
    this.logLevelSelect.value = settings.logLevel;
  }

  private async handleSave() {
    try {
      const newSettings = {
        provider: this.providerSelect.value as
          | "openai"
          | "anthropic"
          | "google",
        apiKey: this.apiKeyInput.value.trim(),
        model: this.modelInput.value.trim(),
        temperature: parseFloat(this.temperatureInput.value),
        autoSolve: this.autoSolveToggle.checked,
        autoWatch: this.autoWatchToggle.checked,
        debugMode: this.debugModeToggle.checked,
        delayBetweenQuestions: parseInt(this.delayInput.value),
        maxRetries: parseInt(this.maxRetriesInput.value),
        // UI/UX preferences
        showNotifications: this.showNotificationsToggle.checked,
        verboseProgress: this.verboseProgressToggle.checked,
        showInlineLogs: this.showInlineLogsToggle.checked,
        playSound: this.playSoundToggle.checked,
        logLevel: this.logLevelSelect.value as
          | "debug"
          | "info"
          | "warn"
          | "error",
      };

      // Validate settings
      const errors = validateSettings(newSettings);
      if (errors.length > 0) {
        this.showStatus(`Validation errors: ${errors.join(", ")}`, "error");
        return;
      }

      // Save settings
      await saveSettings(newSettings);

      // Update logger debug mode
      await logger.setDebugMode(newSettings.debugMode);

      this.showStatus("Settings saved successfully!", "success");
    } catch (error: any) {
      console.error("Failed to save settings:", error);
      this.showStatus(`Error: ${error.message}`, "error");
    }
  }

  private async handleExport() {
    try {
      const json = await exportSettings();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `coursera-skipper-settings-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);

      this.showStatus("Settings exported successfully!", "success");
    } catch (error: any) {
      console.error("Failed to export settings:", error);
      this.showStatus(`Error: ${error.message}`, "error");
    }
  }

  private async handleImport() {
    try {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "application/json";

      input.onchange = async (e: Event) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e: ProgressEvent<FileReader>) => {
          try {
            const json = e.target?.result as string;
            await importSettings(json);
            await this.loadSettings();
            this.showStatus("Settings imported successfully!", "success");
          } catch (error: any) {
            console.error("Failed to import settings:", error);
            this.showStatus(`Error: ${error.message}`, "error");
          }
        };
        reader.readAsText(file);
      };

      input.click();
    } catch (error: any) {
      console.error("Failed to import settings:", error);
      this.showStatus(`Error: ${error.message}`, "error");
    }
  }

  private async handleClearLogs() {
    if (!confirm("Are you sure you want to clear all logs?")) {
      return;
    }

    try {
      logger.clearLogs();
      this.showStatus("Logs cleared successfully!", "success");
    } catch (error: any) {
      console.error("Failed to clear logs:", error);
      this.showStatus(`Error: ${error.message}`, "error");
    }
  }

  private async handleResetAll() {
    if (
      !confirm(
        "Are you sure you want to reset all settings? This cannot be undone."
      )
    ) {
      return;
    }

    try {
      await clearAllStorage();
      await this.loadSettings();
      this.showStatus("All settings reset successfully!", "success");
    } catch (error: any) {
      console.error("Failed to reset settings:", error);
      this.showStatus(`Error: ${error.message}`, "error");
    }
  }

  private showStatus(message: string, type: "success" | "error") {
    this.statusMessage.textContent = message;
    this.statusMessage.className = `status-message status-${type}`;

    if (type === "success") {
      setTimeout(() => {
        this.statusMessage.textContent = "";
        this.statusMessage.className = "status-message";
      }, 3000);
    }
  }
}

// Initialize options UI
document.addEventListener("DOMContentLoaded", () => {
  new OptionsUI();
});
