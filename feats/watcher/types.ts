/**
 * Type definitions for Video Watcher
 */

export interface ItemMetadata {
  can_skip: boolean;
  tracking_id: string;
}

export interface VideoItem {
  id: string;
  name: string;
  timeCommitment: number; // in seconds
}

export interface WatcherConfig {
  item: VideoItem;
  metadata: ItemMetadata;
  userId: string;
  slug: string;
  courseId: string;
  csrfToken?: string;
}

export interface VideoEventPayload {
  contentRequestBody: Record<string, never>;
}

export interface VideoProgressPayload {
  videoProgressId: string;
  viewedUpTo: number;
}
