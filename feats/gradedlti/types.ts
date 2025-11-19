/**
 * Type definitions for Graded LTI (Programming Assignments)
 */

export interface LtiLaunchData {
  endpointUrl: string;
  authRequestUrl: string;
  signedProperties: Record<string, any>;
}

export interface LtiGradedLaunchResponse {
  elements: LtiLaunchData[];
}

export interface ItemOutcome {
  isPassed: boolean;
  grade: number;
}

export interface CourseViewItemGrade {
  itemId: string;
  overallOutcome: ItemOutcome;
  id: string;
  userId: number;
  courseId: string;
}

export interface GradedAssignmentGroup {
  itemIds: string[];
  name: string;
  gradingWeight: number;
  gradingType: {
    typeName: string;
    definition: Record<string, any>;
  };
}

export interface CourseViewGradedAssignmentGroupGrade {
  gradedAssignmentGroup: GradedAssignmentGroup;
  grade: number;
  droppedItemIds: string[];
  id: string;
}

export interface CourseViewTrackAttainment {
  overallPassedCount: number;
  trackId: string;
  id: string;
  verifiedPassedCount: number;
  passingState: string;
}

export interface CourseViewGrades {
  elements: Array<{
    viewId: string;
    verifiedGrade: number;
    overallGrade: number;
    id: string;
    userId: number;
    passingState: string;
  }>;
  paging: Record<string, any>;
  linked: {
    "onDemandCourseViewItemGrades.v1": CourseViewItemGrade[];
    "onDemandCourseViewGradedAssignmentGroupGrades.v1": CourseViewGradedAssignmentGroupGrade[];
    "onDemandCourseViewPassableItemGroupGrades.v1": any[];
    "onDemandCourseViewTrackAttainments.v1": CourseViewTrackAttainment[];
    "onDemandCourseGradeItemOutcomeOverrides.v1": any[];
  };
}

export interface GradedLtiConfig {
  courseId: string;
  itemId: string;
  userId: string;
}
