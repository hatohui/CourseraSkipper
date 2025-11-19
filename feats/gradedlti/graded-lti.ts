/**
 * Graded LTI Handler
 * Handles completion of programming assignments (gradedLti items)
 */

import type {
  GradedLtiConfig,
  LtiGradedLaunchResponse,
  CourseViewGrades,
} from "./types";

const BASE_URL = "https://www.coursera.org/api/";

export class GradedLtiHandler {
  private courseId: string;
  private itemId: string;
  private userId: string;

  constructor(config: GradedLtiConfig) {
    this.courseId = config.courseId;
    this.itemId = config.itemId;
    this.userId = config.userId;

    console.log("[GradedLTI] Initialized with config:", {
      courseId: this.courseId,
      itemId: this.itemId,
      userId: this.userId,
    });
  }

  /**
   * Complete a graded LTI item (programming assignment)
   */
  async completeItem(): Promise<void> {
    try {
      console.log("[GradedLTI] Starting completion process...");

      // Step 1: Get LTI launch data
      console.log("[GradedLTI] Fetching LTI launch data...");
      const launchData = await this.getLtiLaunchData();

      if (!launchData || launchData.elements.length === 0) {
        throw new Error("Could not get LTI launch data");
      }

      console.log("[GradedLTI] LTI launch data retrieved");

      // Step 2: Mark item as passed with grade
      console.log("[GradedLTI] Marking item as passed...");
      await this.markItemAsPassed();

      console.log("[GradedLTI] Item completed successfully");
    } catch (error) {
      console.error("[GradedLTI] Error completing item:", error);
      throw error;
    }
  }

  /**
   * Get LTI launch data for the item
   */
  private async getLtiLaunchData(): Promise<LtiGradedLaunchResponse | null> {
    try {
      const params = new URLSearchParams({
        fields: "endpointUrl,authRequestUrl,signedProperties",
      });

      const response = await fetch(
        `${BASE_URL}onDemandLtiGradedLaunches.v1/?${params}`,
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        console.error(
          "[GradedLTI] Failed to get LTI launch data:",
          response.status
        );
        return null;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("[GradedLTI] Error getting LTI launch data:", error);
      return null;
    }
  }

  /**
   * Mark the item as passed by updating the course grades
   */
  private async markItemAsPassed(): Promise<void> {
    try {
      const userIdNum = parseInt(this.userId);

      // First, get current grades to construct proper request
      const currentGrades = await this.getCourseGrades();

      if (!currentGrades) {
        throw new Error("Could not get current course grades");
      }

      // Find or create the item grade
      const itemGrades =
        currentGrades.linked["onDemandCourseViewItemGrades.v1"] || [];
      let itemGrade = itemGrades.find((ig) => ig.itemId === this.itemId);

      if (!itemGrade) {
        // Create new item grade
        itemGrade = {
          itemId: this.itemId,
          overallOutcome: {
            isPassed: true,
            grade: 1.0,
          },
          id: `${userIdNum}~${this.courseId}~${this.itemId}`,
          userId: userIdNum,
          courseId: this.courseId,
        };
        itemGrades.push(itemGrade);
      } else {
        // Update existing grade
        itemGrade.overallOutcome = {
          isPassed: true,
          grade: 1.0,
        };
      }

      // Update the overall grade calculation
      const totalItems = itemGrades.length;
      const passedItems = itemGrades.filter(
        (ig) => ig.overallOutcome.isPassed
      ).length;
      const overallGrade = totalItems > 0 ? passedItems / totalItems : 0;

      // Construct the request payload
      const payload: CourseViewGrades = {
        elements: [
          {
            viewId: this.courseId,
            verifiedGrade: overallGrade,
            overallGrade: overallGrade,
            id: `${userIdNum}~${this.courseId}`,
            userId: userIdNum,
            passingState: passedItems === totalItems ? "passed" : "notPassed",
          },
        ],
        paging: {},
        linked: {
          "onDemandCourseViewItemGrades.v1": itemGrades,
          "onDemandCourseViewGradedAssignmentGroupGrades.v1":
            currentGrades.linked[
              "onDemandCourseViewGradedAssignmentGroupGrades.v1"
            ] || [],
          "onDemandCourseViewPassableItemGroupGrades.v1":
            currentGrades.linked[
              "onDemandCourseViewPassableItemGroupGrades.v1"
            ] || [],
          "onDemandCourseViewTrackAttainments.v1":
            currentGrades.linked["onDemandCourseViewTrackAttainments.v1"] || [],
          "onDemandCourseGradeItemOutcomeOverrides.v1":
            currentGrades.linked[
              "onDemandCourseGradeItemOutcomeOverrides.v1"
            ] || [],
        },
      };

      // Send the update request
      const params = new URLSearchParams({
        includes:
          "items,tracks,itemOutcomeOverrides,passableItemGroups,gradedAssignmentGroupGrades",
        fields:
          "passingState,overallGrade,verifiedGrade,onDemandCourseViewGradedAssignmentGroupGrades.v1(droppedItemIds,grade,gradedAssignmentGroup),onDemandCourseViewItemGrades.v1(overallOutcome),onDemandCourseGradeItemOutcomeOverrides.v1(grade,isPassed,explanation,overridenAt,overriderId),onDemandCourseViewTrackAttainments.v1(passingState,overallPassedCount,verifiedPassedCount),onDemandCourseViewPassableItemGroupGrades.v1(passingState,overallPassedCount,overallGrade)",
      });

      const response = await fetch(
        `${BASE_URL}onDemandCourseViewGrades.v1/${userIdNum}~${this.courseId}?${params}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          "[GradedLTI] Failed to mark item as passed:",
          response.status,
          errorText
        );
        throw new Error(`Failed to mark item as passed: ${response.status}`);
      }

      console.log("[GradedLTI] Item marked as passed successfully");
    } catch (error) {
      console.error("[GradedLTI] Error marking item as passed:", error);
      throw error;
    }
  }

  /**
   * Get current course grades
   */
  private async getCourseGrades(): Promise<CourseViewGrades | null> {
    try {
      const userIdNum = parseInt(this.userId);
      const params = new URLSearchParams({
        includes:
          "items,tracks,itemOutcomeOverrides,passableItemGroups,gradedAssignmentGroupGrades",
        fields:
          "passingState,overallGrade,verifiedGrade,onDemandCourseViewGradedAssignmentGroupGrades.v1(droppedItemIds,grade,gradedAssignmentGroup),onDemandCourseViewItemGrades.v1(overallOutcome),onDemandCourseGradeItemOutcomeOverrides.v1(grade,isPassed,explanation,overridenAt,overriderId),onDemandCourseViewTrackAttainments.v1(passingState,overallPassedCount,verifiedPassedCount),onDemandCourseViewPassableItemGroupGrades.v1(passingState,overallPassedCount,overallGrade)",
      });

      const response = await fetch(
        `${BASE_URL}onDemandCourseViewGrades.v1/${userIdNum}~${this.courseId}?${params}`,
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        console.error(
          "[GradedLTI] Failed to get course grades:",
          response.status
        );
        return null;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("[GradedLTI] Error getting course grades:", error);
      return null;
    }
  }
}

/**
 * Create a graded LTI handler instance
 */
export function createGradedLtiHandler(
  config: GradedLtiConfig
): GradedLtiHandler {
  return new GradedLtiHandler(config);
}
