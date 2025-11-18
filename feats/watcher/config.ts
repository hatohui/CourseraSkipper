/**
 * Configuration constants for Video Watcher
 */

export const BASE_URL = "https://www.coursera.org/api/";

export const DELAYS = {
  AFTER_PROGRESS_UPDATE: 3000, // 3 seconds
} as const;

/**
 * API endpoint builders
 */
export const buildPlayEventUrl = (
  userId: string,
  slug: string,
  itemId: string
): string => {
  return `${BASE_URL}opencourse.v1/user/${userId}/course/${slug}/item/${itemId}/lecture/videoEvents/play?autoEnroll=false`;
};

export const buildEndEventUrl = (
  userId: string,
  slug: string,
  itemId: string
): string => {
  return `${BASE_URL}opencourse.v1/user/${userId}/course/${slug}/item/${itemId}/lecture/videoEvents/ended?autoEnroll=false`;
};

export const buildProgressUrl = (
  userId: string,
  courseId: string,
  trackingId: string
): string => {
  return `${BASE_URL}onDemandVideoProgresses.v1/${userId}~${courseId}~${trackingId}`;
};
