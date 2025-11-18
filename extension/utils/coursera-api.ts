/**
 * Coursera API Utility
 * Fetches course and item metadata from Coursera's REST API
 */

const BASE_URL = "https://www.coursera.org/api/";

export interface CourseraUser {
  id: string;
  email?: string;
}

export interface VideoMetadata {
  can_skip: boolean;
  tracking_id: string;
}

export interface ItemData {
  id: string;
  name: string;
  slug: string;
  timeCommitment: number;
  contentSummary: {
    typeName: string;
  };
}

/**
 * Get the current user ID from Coursera
 */
export async function getUserId(): Promise<string | null> {
  try {
    const response = await fetch(`${BASE_URL}adminUserPermissions.v1?q=my`, {
      credentials: "include",
    });

    if (!response.ok) {
      console.error("[CourseraAPI] Failed to get user ID:", response.status);
      return null;
    }

    const data = await response.json();
    if (data.elements && data.elements.length > 0) {
      return data.elements[0].id;
    }

    return null;
  } catch (error) {
    console.error("[CourseraAPI] Error getting user ID:", error);
    return null;
  }
}

/**
 * Get video metadata for a specific item
 */
export async function getVideoMetadata(
  courseId: string,
  itemId: string
): Promise<VideoMetadata | null> {
  try {
    const url = `${BASE_URL}onDemandLectureVideos.v1/${courseId}~${itemId}`;
    const params = new URLSearchParams({
      includes: "video",
      fields: "disableSkippingForward,startMs,endMs",
    });

    const response = await fetch(`${url}?${params}`, {
      credentials: "include",
    });

    if (!response.ok) {
      console.error(
        "[CourseraAPI] Failed to get video metadata:",
        response.status
      );
      return null;
    }

    const data = await response.json();

    if (!data.elements || data.elements.length === 0) {
      return null;
    }

    const element = data.elements[0];
    const video = data.linked?.["onDemandVideos.v1"]?.[0];

    return {
      can_skip: !element.disableSkippingForward,
      tracking_id: video?.id || "",
    };
  } catch (error) {
    console.error("[CourseraAPI] Error getting video metadata:", error);
    return null;
  }
}

/**
 * Get course materials including items
 */
export async function getCourseData(courseSlug: string): Promise<any> {
  try {
    const params = new URLSearchParams({
      q: "slug",
      slug: courseSlug,
      includes:
        "modules,lessons,passableItemGroups,passableItemGroupChoices,passableLessonElements,items,tracks,gradePolicy,gradingParameters,embeddedContentMapping",
      fields:
        "moduleIds,onDemandCourseMaterialModules.v1(name,slug,description,timeCommitment,lessonIds,optional,learningObjectives),onDemandCourseMaterialLessons.v1(name,slug,timeCommitment,elementIds,optional,trackId),onDemandCourseMaterialPassableItemGroups.v1(requiredPassedCount,passableItemGroupChoiceIds,trackId),onDemandCourseMaterialPassableItemGroupChoices.v1(name,description,itemIds),onDemandCourseMaterialPassableLessonElements.v1(gradingWeight,isRequiredForPassing),onDemandCourseMaterialItems.v2(name,originalName,slug,timeCommitment,contentSummary,isLocked,lockableByItem,itemLockedReasonCode,trackId,lockedStatus,itemLockSummary,customDisplayTypenameOverride),onDemandCourseMaterialTracks.v1(passablesCount),onDemandGradingParameters.v1(gradedAssignmentGroups),contentAtomRelations.v1(embeddedContentSourceCourseId,subContainerId)",
      showLockedItems: "true",
    });

    const response = await fetch(
      `${BASE_URL}onDemandCourseMaterials.v2/?${params}`,
      {
        credentials: "include",
      }
    );

    if (!response.ok) {
      console.error(
        "[CourseraAPI] Failed to get course data:",
        response.status
      );
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("[CourseraAPI] Error getting course data:", error);
    return null;
  }
}

/**
 * Get item data by itemId from course materials
 */
export async function getItemData(
  courseSlug: string,
  itemId: string
): Promise<ItemData | null> {
  try {
    const courseData = await getCourseData(courseSlug);

    if (!courseData || !courseData.linked) {
      return null;
    }

    const items = courseData.linked["onDemandCourseMaterialItems.v2"] || [];
    const item = items.find((i: any) => i.id === itemId);

    if (!item) {
      console.error("[CourseraAPI] Item not found:", itemId);
      return null;
    }

    return item;
  } catch (error) {
    console.error("[CourseraAPI] Error getting item data:", error);
    return null;
  }
}

/**
 * Get course ID from slug
 */
export async function getCourseId(courseSlug: string): Promise<string | null> {
  try {
    const courseData = await getCourseData(courseSlug);

    if (
      !courseData ||
      !courseData.elements ||
      courseData.elements.length === 0
    ) {
      return null;
    }

    return courseData.elements[0].id;
  } catch (error) {
    console.error("[CourseraAPI] Error getting course ID:", error);
    return null;
  }
}

/**
 * Mark a reading/supplement item as complete
 */
export async function markReadingComplete(
  courseId: string,
  itemId: string,
  userId: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `${BASE_URL}onDemandSupplementCompletions.v1`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          courseId,
          itemId,
          userId: parseInt(userId),
        }),
      }
    );

    const text = await response.text();
    return text.includes("Completed");
  } catch (error) {
    console.error("[CourseraAPI] Error marking reading complete:", error);
    return false;
  }
}

/**
 * Generate CSRF token
 * Based on Python implementation: timestamp + random string
 */
export function generateCsrfToken(): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const randomStr = Math.random().toString(36).substring(2, 15);
  return `${timestamp}.${randomStr}`;
}

export interface ModuleItemSummary {
  id: string;
  name: string;
  slug: string;
  type:
    | "quiz"
    | "video"
    | "reading"
    | "programming"
    | "peer-review"
    | "unknown";
  timeCommitment: number;
}

export interface ModuleData {
  moduleId: string;
  name: string;
  slug: string;
  items: ModuleItemSummary[];
  counts: {
    quiz: number;
    video: number;
    reading: number;
    programming: number;
    "peer-review": number;
    total: number;
  };
}

/**
 * Get module data with all items and their types
 */
export async function getModuleData(
  courseSlug: string,
  moduleNumber: number
): Promise<ModuleData | null> {
  try {
    console.log("[CourseraAPI] Fetching module data:", {
      courseSlug,
      moduleNumber,
    });
    const courseData = await getCourseData(courseSlug);

    if (!courseData || !courseData.linked) {
      console.error("[CourseraAPI] No course data or linked data");
      return null;
    }

    console.log("[CourseraAPI] Course data received", {
      hasModules: !!courseData.linked["onDemandCourseMaterialModules.v1"],
      moduleCount:
        courseData.linked["onDemandCourseMaterialModules.v1"]?.length || 0,
    });

    const modules = courseData.linked["onDemandCourseMaterialModules.v1"] || [];
    const lessons = courseData.linked["onDemandCourseMaterialLessons.v1"] || [];
    const items = courseData.linked["onDemandCourseMaterialItems.v2"] || [];

    // Module numbers are 1-indexed, array is 0-indexed
    const module = modules[moduleNumber - 1];
    if (!module) {
      console.error("[CourseraAPI] Module not found:", moduleNumber);
      return null;
    }

    // Get all lessons for this module
    const moduleLessons = lessons.filter((lesson: any) =>
      module.lessonIds?.includes(lesson.id)
    );

    // Get all items for these lessons
    const moduleItemIds = new Set<string>();
    moduleLessons.forEach((lesson: any) => {
      lesson.elementIds?.forEach((elementId: string) => {
        // Element IDs are in format "itemId@version"
        const itemId = elementId.split("@")[0];
        moduleItemIds.add(itemId);
      });
    });

    // Build item summaries with type detection
    const itemSummaries: ModuleItemSummary[] = [];
    const counts = {
      quiz: 0,
      video: 0,
      reading: 0,
      programming: 0,
      "peer-review": 0,
      total: 0,
    };

    for (const itemId of moduleItemIds) {
      const item = items.find((i: any) => i.id === itemId);
      if (!item) continue;

      // Detect item type from contentSummary.typeName
      let type: ModuleItemSummary["type"] = "unknown";
      const typeName = item.contentSummary?.typeName?.toLowerCase() || "";

      if (typeName.includes("exam") || typeName.includes("quiz")) {
        type = "quiz";
        counts.quiz++;
      } else if (typeName.includes("lecture") || typeName.includes("video")) {
        type = "video";
        counts.video++;
      } else if (
        typeName.includes("supplement") ||
        typeName.includes("reading")
      ) {
        type = "reading";
        counts.reading++;
      } else if (typeName.includes("programming")) {
        type = "programming";
        counts.programming++;
      } else if (typeName.includes("peer")) {
        type = "peer-review";
        counts["peer-review"]++;
      }

      itemSummaries.push({
        id: item.id,
        name: item.name || item.originalName || "Untitled",
        slug: item.slug,
        type,
        timeCommitment: item.timeCommitment || 0,
      });

      counts.total++;
    }

    return {
      moduleId: module.id,
      name: module.name,
      slug: module.slug,
      items: itemSummaries,
      counts,
    };
  } catch (error) {
    console.error("[CourseraAPI] Error getting module data:", error);
    return null;
  }
}
