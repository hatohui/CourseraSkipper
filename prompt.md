You know the api return these right:

```json
"modules": [
                        {
                            "moduleTimeProgress": {
                                "readingsProgress": {
                                    "totalDuration": 4620000,
                                    "remainingDuration": 4620000,
                                    "nextItem": {
                                        "computedProgressState": "NotStarted",
                                        "itemDeadlineStatus": "ONTRACK",
                                        "trackId": "core",
                                        "resourcePath": "/learn/aws-cloud-technical-essentials/supplement/TSFTp/reading-4-1-monitoring-on-aws",
                                        "isLocked": false,
                                        "name": "Reading 4.1: Monitoring on AWS",
                                        "id": "TSFTp",
                                        "isOptional": false,
                                        "timeCommitment": 600000,
                                        "contentSummary": {
                                            "typeName": "supplement",
                                            "definition": {
                                                "assetTypeName": "cml",
                                                "containsWidget": false
                                            }
                                        }
                                    },
                                    "totalCount": 6,
                                    "remainingCount": 6
                                },
                                ...
```

I figured out is that `typeName` under `contentSummary` defines the type of excercises

- `lecture` is `video`
- `supplement` is `reading`
- `staffGraded` is `Graded Assignment`
- `gradedLti` is `Graded App Item`
- `ungradedAssignment` is `Practice Assignment`
