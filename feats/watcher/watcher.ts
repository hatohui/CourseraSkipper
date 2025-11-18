/**
 * Video Watcher for Coursera
 * Auto-completes video content
 * Migrated from Python implementation
 */

import type {
  ItemMetadata,
  VideoItem,
  WatcherConfig,
  VideoEventPayload,
  VideoProgressPayload,
} from "./types";

import {
  buildPlayEventUrl,
  buildEndEventUrl,
  buildProgressUrl,
  DELAYS,
} from "./config";

export class Watcher {
  private metadata: ItemMetadata;
  private item: VideoItem;
  private slug: string;
  private userId: string;
  private courseId: string;
  private csrfToken: string;

  constructor(config: WatcherConfig) {
    this.metadata = config.metadata;
    this.item = config.item;
    this.slug = config.slug;
    this.userId = config.userId;
    this.courseId = config.courseId;
    this.csrfToken = config.csrfToken || this.generateCsrfToken();
  }

  /**
   * Main watch logic - handles both skippable and regular videos
   */
  async watchItem(): Promise<void> {
    try {
      if (this.metadata.can_skip) {
        console.log(`[Watcher] Skippable video: ${this.item.name}`);
        await this.endItem();
      } else {
        console.log(`[Watcher] Watching video: ${this.item.name}`);
        await this.startItem();
        await this.updateProgress();
        await this.endItem();
      }
      console.log(`[Watcher] Completed: ${this.item.name}`);
    } catch (error) {
      console.error(`[Watcher] Error watching item ${this.item.name}:`, error);
      throw error;
    }
  }

  /**
   * Start watching a video item
   */
  private async startItem(): Promise<void> {
    try {
      const url = buildPlayEventUrl(this.userId, this.slug, this.item.id);
      const payload: VideoEventPayload = {
        contentRequestBody: {},
      };

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf3-token": this.csrfToken,
        },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      if (response.status !== 200) {
        throw new Error(`Failed to start video. Status: ${response.status}`);
      }

      console.log(`[Watcher] Started video: ${this.item.name}`);
    } catch (error) {
      console.error(`[Watcher] Couldn't start video ${this.item.name}:`, error);
      throw error;
    }
  }

  /**
   * End watching a video item
   * Can be called directly for skippable videos
   */
  private async endItem(): Promise<void> {
    try {
      const url = buildEndEventUrl(this.userId, this.slug, this.item.id);
      const payload: VideoEventPayload = {
        contentRequestBody: {},
      };

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf3-token": this.csrfToken,
        },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      if (response.status !== 200) {
        throw new Error(`Failed to end video. Status: ${response.status}`);
      }

      console.log(`[Watcher] Ended video: ${this.item.name}`);
    } catch (error) {
      console.error(
        `[Watcher] Couldn't end watching ${this.item.name}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Update the watch progress of a video
   */
  private async updateProgress(): Promise<void> {
    try {
      const url = buildProgressUrl(
        this.userId,
        this.courseId,
        this.metadata.tracking_id
      );

      const payload: VideoProgressPayload = {
        videoProgressId: `${this.userId}~${this.courseId}~${this.metadata.tracking_id}`,
        viewedUpTo: this.item.timeCommitment,
      };

      const response = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-csrf3-token": this.csrfToken,
        },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      if (response.status !== 204) {
        throw new Error(
          `Failed to update progress. Status: ${response.status}`
        );
      }

      console.log(`[Watcher] Updated progress for: ${this.item.name}`);

      // Wait 3 seconds after updating progress
      await this.delay(DELAYS.AFTER_PROGRESS_UPDATE);
    } catch (error) {
      console.error(
        `[Watcher] Couldn't update progress for ${this.item.name}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Generate a CSRF token
   * TODO: Implement proper CSRF token generation/retrieval
   */
  private generateCsrfToken(): string {
    // For now, use a placeholder. In production:
    // - Extract from cookies
    // - Or generate based on timestamp + random value
    const timestamp = Math.floor(Date.now() / 1000);
    const randomStr = Math.random().toString(36).substring(2, 15);
    return `${timestamp}.${randomStr}`;
  }

  /**
   * Update CSRF token if needed
   */
  public updateCsrfToken(token: string): void {
    this.csrfToken = token;
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create a watcher instance
 */
export function createWatcher(config: WatcherConfig): Watcher {
  return new Watcher(config);
}
