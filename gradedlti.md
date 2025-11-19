https://www.coursera.org/api/onDemandLtiGradedLaunches.v1/?fields=endpointUrl%2CauthRequestUrl%2CsignedProperties

For gradedLti, you first need to tick these.

then i think you sending with these:

to: https://www.coursera.org/api/onDemandCourseViewGrades.v1/138682734~dQdSvWdUEeuI4Aqy1at7YQ?includes=items%2Ctracks%2CitemOutcomeOverrides%2CpassableItemGroups%2CgradedAssignmentGroupGrades&fields=passingState%2CoverallGrade%2CverifiedGrade%2ConDemandCourseViewGradedAssignmentGroupGrades.v1(droppedItemIds%2Cgrade%2CgradedAssignmentGroup)%2ConDemandCourseViewItemGrades.v1(overallOutcome)%2ConDemandCourseGradeItemOutcomeOverrides.v1(grade%2CisPassed%2Cexplanation%2CoverridenAt%2CoverriderId)%2ConDemandCourseViewTrackAttainments.v1(passingState%2CoverallPassedCount%2CverifiedPassedCount)%2ConDemandCourseViewPassableItemGroupGrades.v1(passingState%2CoverallPassedCount%2CoverallGrade)

request:

```json
{
  "elements": [
    {
      "viewId": "dQdSvWdUEeuI4Aqy1at7YQ",
      "verifiedGrade": 0.23333333333333334,
      "overallGrade": 0.23333333333333334,
      "id": "138682734~dQdSvWdUEeuI4Aqy1at7YQ",
      "userId": 138682734,
      "passingState": "notPassed"
    }
  ],
  "paging": {},
  "linked": {
    "onDemandCourseViewItemGrades.v1": [
      {
        "itemId": "56jy9",
        "overallOutcome": {
          "isPassed": true,
          "grade": 1
        },
        "id": "138682734~dQdSvWdUEeuI4Aqy1at7YQ~56jy9",
        "userId": 138682734,
        "courseId": "dQdSvWdUEeuI4Aqy1at7YQ"
      },
      {
        "itemId": "9CRRy",
        "overallOutcome": {
          "isPassed": true,
          "grade": 1
        },
        "id": "138682734~dQdSvWdUEeuI4Aqy1at7YQ~9CRRy",
        "userId": 138682734,
        "courseId": "dQdSvWdUEeuI4Aqy1at7YQ"
      }
    ],
    "onDemandCourseViewGradedAssignmentGroupGrades.v1": [
      {
        "gradedAssignmentGroup": {
          "itemIds": ["PnCx4", "zl7Va", "OERYN", "9CRRy"],
          "name": "Quiz",
          "gradingWeight": 4000,
          "gradingType": {
            "typeName": "selectTopKGradingType",
            "definition": {
              "numberOfSelectedItems": 3
            }
          }
        },
        "grade": 0.3333333333333333,
        "droppedItemIds": [],
        "id": "vghvh"
      }
    ],
    "onDemandCourseViewPassableItemGroupGrades.v1": [],
    "onDemandCourseViewTrackAttainments.v1": [
      {
        "overallPassedCount": 2,
        "trackId": "core",
        "id": "138682734~dQdSvWdUEeuI4Aqy1at7YQ~core",
        "verifiedPassedCount": 2,
        "passingState": "notPassed"
      }
    ],
    "onDemandCourseGradeItemOutcomeOverrides.v1": []
  }
}
```
