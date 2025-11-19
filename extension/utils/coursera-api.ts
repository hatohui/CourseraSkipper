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
 * Get guided course session progress data
 * This API returns week/module information with all items
 */
async function getGuidedCourseProgress(
  userId: string,
  courseId: string
): Promise<any> {
  try {
    const params = new URLSearchParams({
      ids: `${userId}~${courseId}`,
      fields: "id,weeks",
    });

    const response = await fetch(
      `${BASE_URL}guidedCourseSessionProgresses.v1?${params}`,
      {
        credentials: "include",
      }
    );

    if (!response.ok) {
      console.error(
        "[CourseraAPI] Failed to get guided course progress:",
        response.status
      );
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("[CourseraAPI] Error getting guided course progress:", error);
    return null;
  }
}

/**
 * Detect item type from contentSummary.typeName
 * Based on Coursera's actual API structure
 */
function detectItemType(
  typeName: string,
  resourcePath: string
): ModuleItemSummary["type"] {
  const type = typeName.toLowerCase();

  // Map based on contentSummary.typeName
  if (type === "lecture") {
    return "video";
  } else if (type === "supplement") {
    return "reading";
  } else if (type === "staffgraded") {
    return "quiz"; // Graded Assignment
  } else if (type === "gradedlti") {
    return "programming"; // Graded App Item
  } else if (type === "ungradedassignment") {
    return "quiz"; // Practice Assignment
  } else if (type.includes("exam") || type.includes("quiz")) {
    return "quiz";
  } else if (type.includes("programming")) {
    return "programming";
  } else if (type.includes("peer")) {
    return "peer-review";
  }

  // Fallback to path-based detection
  const path = resourcePath.toLowerCase();
  if (path.includes("/lecture/")) {
    return "video";
  } else if (path.includes("/supplement/")) {
    return "reading";
  } else if (path.includes("/exam/") || path.includes("/quiz/")) {
    return "quiz";
  } else if (path.includes("/programming/")) {
    return "programming";
  } else if (path.includes("/peer/")) {
    return "peer-review";
  }

  return "unknown";
}

/**
 * Get module data with all items and their types using the guided course progress API
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

    // First get user ID
    const userId = await getUserId();
    if (!userId) {
      console.error("[CourseraAPI] Could not get user ID");
      return null;
    }

    // Get course ID
    const courseId = await getCourseId(courseSlug);
    if (!courseId) {
      console.error("[CourseraAPI] Could not get course ID");
      return null;
    }

    console.log("[CourseraAPI] Fetching from guidedCourseSessionProgresses", {
      userId,
      courseId,
    });

    // Get guided course progress
    const progressData = await getGuidedCourseProgress(userId, courseId);
    if (
      !progressData ||
      !progressData.elements ||
      progressData.elements.length === 0
    ) {
      console.error("[CourseraAPI] No progress data found");
      return null;
    }

    const courseProgress = progressData.elements[0];
    if (!courseProgress.weeks || !Array.isArray(courseProgress.weeks)) {
      console.error("[CourseraAPI] No weeks data in progress");
      return null;
    }

    console.log("[CourseraAPI] Found weeks:", courseProgress.weeks.length);

    // Module numbers are 1-indexed, array is 0-indexed
    const weekIndex = moduleNumber - 1;
    if (weekIndex < 0 || weekIndex >= courseProgress.weeks.length) {
      console.error("[CourseraAPI] Module/week index out of bounds:", {
        moduleNumber,
        weekIndex,
        totalWeeks: courseProgress.weeks.length,
      });
      return null;
    }

    const week = courseProgress.weeks[weekIndex];
    console.log("[CourseraAPI] Week data:", week);

    // Extract module information
    const modules = week.modules || [];
    if (modules.length === 0) {
      console.warn("[CourseraAPI] No modules found in week");
      return null;
    }

    // Collect all items from all modules in this week
    const allItems: ModuleItemSummary[] = [];
    const counts = {
      quiz: 0,
      video: 0,
      reading: 0,
      programming: 0,
      "peer-review": 0,
      total: 0,
    };

    let moduleName = `Week ${moduleNumber}`;
    let moduleId = "";

    for (const module of modules) {
      if (module.name) {
        moduleName = module.name;
      }
      if (module.id) {
        moduleId = module.id;
      }

      const items = module.items || [];
      console.log(
        `[CourseraAPI] Module "${module.name}" has ${items.length} items`
      );

      for (const item of items) {
        const typeName = item.contentSummary?.typeName || "";
        const resourcePath = item.resourcePath || "";
        const type = detectItemType(typeName, resourcePath);

        // Update counts
        if (type === "quiz") counts.quiz++;
        else if (type === "video") counts.video++;
        else if (type === "reading") counts.reading++;
        else if (type === "programming") counts.programming++;
        else if (type === "peer-review") counts["peer-review"]++;

        counts.total++;

        allItems.push({
          id: item.id || item.trackId,
          name: item.name || "Untitled",
          slug: item.slug || "",
          type,
          timeCommitment: item.timeCommitment || 0,
        });
      }
    }

    console.log("[CourseraAPI] Module data processed:", {
      moduleName,
      totalItems: allItems.length,
      counts,
    });

    return {
      moduleId: moduleId,
      name: moduleName,
      slug: "",
      items: allItems,
      counts,
    };
  } catch (error) {
    console.error("[CourseraAPI] Error getting module data:", error);
    return null;
  }
}

/**
 * Get all course modules data
 */
export async function getAllModulesData(
  courseSlug: string
): Promise<ModuleData[]> {
  try {
    console.log("[CourseraAPI] Fetching all modules data:", { courseSlug });

    // First get user ID
    const userId = await getUserId();
    if (!userId) {
      console.error("[CourseraAPI] Could not get user ID");
      return [];
    }

    // Get course ID
    const courseId = await getCourseId(courseSlug);
    if (!courseId) {
      console.error("[CourseraAPI] Could not get course ID");
      return [];
    }

    // Get guided course progress
    const progressData = await getGuidedCourseProgress(userId, courseId);
    if (
      !progressData ||
      !progressData.elements ||
      progressData.elements.length === 0
    ) {
      console.error("[CourseraAPI] No progress data found");
      return [];
    }

    const courseProgress = progressData.elements[0];
    if (!courseProgress.weeks || !Array.isArray(courseProgress.weeks)) {
      console.error("[CourseraAPI] No weeks data in progress");
      return [];
    }

    const allModules: ModuleData[] = [];

    // Process each week/module
    for (
      let weekIndex = 0;
      weekIndex < courseProgress.weeks.length;
      weekIndex++
    ) {
      const week = courseProgress.weeks[weekIndex];
      const modules = week.modules || [];

      if (modules.length === 0) continue;

      const allItems: ModuleItemSummary[] = [];
      const counts = {
        quiz: 0,
        video: 0,
        reading: 0,
        programming: 0,
        "peer-review": 0,
        total: 0,
      };

      let moduleName = `Week ${weekIndex + 1}`;
      let moduleId = "";

      for (const module of modules) {
        if (module.name) {
          moduleName = module.name;
        }
        if (module.id) {
          moduleId = module.id;
        }

        const items = module.items || [];

        for (const item of items) {
          const typeName = item.contentSummary?.typeName || "";
          const resourcePath = item.resourcePath || "";
          const type = detectItemType(typeName, resourcePath);

          // Update counts
          if (type === "quiz") counts.quiz++;
          else if (type === "video") counts.video++;
          else if (type === "reading") counts.reading++;
          else if (type === "programming") counts.programming++;
          else if (type === "peer-review") counts["peer-review"]++;

          counts.total++;

          allItems.push({
            id: item.id || item.trackId,
            name: item.name || "Untitled",
            slug: item.slug || "",
            type,
            timeCommitment: item.timeCommitment || 0,
          });
        }
      }

      allModules.push({
        moduleId: moduleId,
        name: moduleName,
        slug: "",
        items: allItems,
        counts,
      });
    }

    console.log("[CourseraAPI] All modules data processed:", {
      totalModules: allModules.length,
      totalItems: allModules.reduce((sum, m) => sum + m.counts.total, 0),
    });

    return allModules;
  } catch (error) {
    console.error("[CourseraAPI] Error getting all modules data:", error);
    return [];
  }
}
