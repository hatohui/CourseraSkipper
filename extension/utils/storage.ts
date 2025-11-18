/**
 * Storage Management Utility
 * Handles all chrome.storage operations with type safety
 */

export interface Settings {
  apiKey: string;
  provider: "openai" | "anthropic" | "google";
  model: string;
  autoSolve: boolean;
  autoWatch: boolean;
  delayBetweenQuestions: number;
  maxRetries: number;
  debugMode: boolean;
  temperature: number;
  // UI/UX preferences
  showNotifications: boolean;
  verboseProgress: boolean;
  showInlineLogs: boolean;
  playSound: boolean;
  logLevel: "debug" | "info" | "warn" | "error";
}

export interface CourseProgress {
  courseId: string;
  itemId: string;
  status: "in-progress" | "completed" | "failed";
  timestamp: number;
  error?: string;
}

export interface StorageData {
  settings: Settings;
  progress: CourseProgress[];
  sessionToken?: string;
}

// Default settings
const DEFAULT_SETTINGS: Settings = {
  apiKey: "",
  provider: "openai",
  model: "gpt-4",
  autoSolve: true,
  autoWatch: true,
  delayBetweenQuestions: 2000,
  maxRetries: 3,
  debugMode: false,
  temperature: 0.7,
  // UI/UX defaults
  showNotifications: true,
  verboseProgress: true,
  showInlineLogs: true,
  playSound: false,
  logLevel: "info",
};

/**
 * Get all settings from storage
 */
export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.sync.get("settings");
  return { ...DEFAULT_SETTINGS, ...result.settings };
}

/**
 * Save settings to storage
 */
export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  const updated = { ...current, ...settings };
  await chrome.storage.sync.set({ settings: updated });
}

/**
 * Get a specific setting value
 */
export async function getSetting<K extends keyof Settings>(
  key: K
): Promise<Settings[K]> {
  const settings = await getSettings();
  return settings[key];
}

/**
 * Validate settings
 */
export function validateSettings(settings: Partial<Settings>): string[] {
  const errors: string[] = [];

  if (settings.apiKey !== undefined) {
    if (settings.apiKey.length === 0) {
      errors.push("API key cannot be empty");
    }
  }

  if (settings.delayBetweenQuestions !== undefined) {
    if (settings.delayBetweenQuestions < 0) {
      errors.push("Delay must be non-negative");
    }
  }

  if (settings.maxRetries !== undefined) {
    if (settings.maxRetries < 0 || settings.maxRetries > 10) {
      errors.push("Max retries must be between 0 and 10");
    }
  }

  if (settings.temperature !== undefined) {
    if (settings.temperature < 0 || settings.temperature > 2) {
      errors.push("Temperature must be between 0 and 2");
    }
  }

  return errors;
}

/**
 * Get course progress from storage
 */
export async function getCourseProgress(): Promise<CourseProgress[]> {
  const result = await chrome.storage.local.get("progress");
  return result.progress || [];
}

/**
 * Save course progress to storage
 */
export async function saveCourseProgress(
  progress: CourseProgress
): Promise<void> {
  const current = await getCourseProgress();
  const updated = current.filter(
    (p) => !(p.courseId === progress.courseId && p.itemId === progress.itemId)
  );
  updated.push(progress);
  await chrome.storage.local.set({ progress: updated });
}

/**
 * Clear course progress
 */
export async function clearCourseProgress(): Promise<void> {
  await chrome.storage.local.remove("progress");
}

/**
 * Get session token
 */
export async function getSessionToken(): Promise<string | undefined> {
  const result = await chrome.storage.local.get("sessionToken");
  return result.sessionToken;
}

/**
 * Save session token
 */
export async function saveSessionToken(token: string): Promise<void> {
  await chrome.storage.local.set({ sessionToken: token });
}

/**
 * Clear session token
 */
export async function clearSessionToken(): Promise<void> {
  await chrome.storage.local.remove("sessionToken");
}

/**
 * Clear all storage
 */
export async function clearAllStorage(): Promise<void> {
  await chrome.storage.sync.clear();
  await chrome.storage.local.clear();
}

/**
 * Export settings as JSON
 */
export async function exportSettings(): Promise<string> {
  const settings = await getSettings();
  // Remove sensitive data
  const exportData = { ...settings, apiKey: "" };
  return JSON.stringify(exportData, null, 2);
}

/**
 * Import settings from JSON
 */
export async function importSettings(json: string): Promise<void> {
  const settings = JSON.parse(json) as Partial<Settings>;
  const errors = validateSettings(settings);
  if (errors.length > 0) {
    throw new Error(`Invalid settings: ${errors.join(", ")}`);
  }
  await saveSettings(settings);
}
