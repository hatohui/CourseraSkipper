/**
 * Notification Utility
 * Handles browser notifications based on user preferences
 */

import { getSetting } from "./storage";

export interface NotificationOptions {
  title: string;
  message: string;
  type?: "basic" | "progress";
  iconUrl?: string;
  priority?: number;
  requireInteraction?: boolean;
}

/**
 * Show a notification if enabled in settings
 */
export async function showNotification(
  options: NotificationOptions
): Promise<string | null> {
  try {
    // Check if notifications are enabled
    const showNotifications = await getSetting("showNotifications");
    if (!showNotifications) {
      return null;
    }

    // Use Chrome extension API for notifications
    return new Promise((resolve, reject) => {
      chrome.notifications.create(
        {
          type: options.type || "basic",
          iconUrl:
            options.iconUrl || chrome.runtime.getURL("assets/icon-128.png"),
          title: options.title,
          message: options.message,
          priority: options.priority || 1,
          requireInteraction: options.requireInteraction || false,
        },
        (notificationId) => {
          if (chrome.runtime.lastError) {
            console.error("Notification error:", chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else {
            resolve(notificationId);
          }
        }
      );
    });
  } catch (error) {
    console.error("Failed to show notification:", error);
    return null;
  }
}

/**
 * Show completion notification with optional sound
 */
export async function showCompletionNotification(
  itemType: "assessment" | "video" | "module",
  itemName?: string
): Promise<void> {
  let typeLabel = "Item";
  if (itemType === "assessment") typeLabel = "Assessment";
  else if (itemType === "video") typeLabel = "Video";
  else if (itemType === "module") typeLabel = "Module";

  const title = `✓ ${typeLabel} Completed`;
  const message = itemName
    ? `Successfully completed: ${itemName}`
    : `${typeLabel} completed successfully`;

  await showNotification({
    title,
    message,
    priority: 2,
  });

  // Play sound if enabled
  const playSound = await getSetting("playSound");
  if (playSound) {
    playCompletionSound();
  }
}

/**
 * Show error notification
 */
export async function showErrorNotification(
  message: string,
  error?: string
): Promise<void> {
  await showNotification({
    title: "⚠ Error Occurred",
    message: error ? `${message}: ${error}` : message,
    priority: 2,
    requireInteraction: true,
  });
}

/**
 * Show progress notification (for multi-step operations)
 */
export async function showProgressNotification(
  title: string,
  message: string,
  progress: number
): Promise<void> {
  const verboseProgress = await getSetting("verboseProgress");
  if (!verboseProgress) {
    return; // Only show if verbose mode is enabled
  }

  await showNotification({
    title,
    message: `${message} (${Math.round(progress * 100)}%)`,
    type: "progress",
  });
}

/**
 * Play completion sound
 */
function playCompletionSound(): void {
  try {
    // Create an audio element
    const audio = new Audio();

    // Use a simple data URI for a short beep sound
    // This is a simple sine wave beep at 800Hz for 200ms
    const audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = "sine";

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext.currentTime + 0.2
    );

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  } catch (error) {
    console.error("Failed to play sound:", error);
  }
}

/**
 * Clear a specific notification
 */
export async function clearNotification(notificationId: string): Promise<void> {
  try {
    await chrome.notifications.clear(notificationId);
  } catch (error) {
    console.error("Failed to clear notification:", error);
  }
}

/**
 * Clear all notifications
 */
export async function clearAllNotifications(): Promise<void> {
  try {
    chrome.notifications.getAll((notificationIds) => {
      for (const id in notificationIds) {
        chrome.notifications.clear(id);
      }
    });
  } catch (error) {
    console.error("Failed to clear all notifications:", error);
  }
}
