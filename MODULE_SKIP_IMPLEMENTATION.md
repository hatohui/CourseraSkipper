# Module Skip Implementation

## Overview

Implemented automatic module skipping functionality for Coursera courses. When users navigate to a module overview page (e.g., `https://www.coursera.org/learn/aws-cloud-technical-essentials/home/module/3`), they can now see module statistics and skip all items in the module automatically.

## Features Implemented

### 1. Module Page Detection

- **File**: `extension/utils/course-detection.ts`
- Added `isModulePage()` function to detect module overview pages
- Updated `CourseInfo` interface to include `moduleNumber` field
- Updated `detectCourseInfo()` to parse module URLs (pattern: `/home/module/{number}`)
- Added "module" as a new item type

### 2. Module Data Fetching

- **File**: `extension/utils/coursera-api.ts`
- Added `ModuleData` and `ModuleItemSummary` interfaces
- Implemented `getModuleData(courseSlug, moduleNumber)` function that:
  - Fetches course materials from Coursera API
  - Extracts module information by number (1-indexed)
  - Gets all lessons and items for the module
  - Categorizes items by type (video, reading, quiz, programming, peer-review)
  - Returns item counts and full item list

### 3. Module Skip UI Widget

- **File**: `extension/content/content-script.ts`
- Added `handleModulePage()` method to detect and handle module pages
- Implemented `injectModuleSkipUI()` to create a floating widget showing:
  - Module number in header
  - Loading state while fetching data
  - Statistics grid with counts for each item type (videos, readings, quizzes, programming)
  - "Skip All Items" button to start automation
  - Elegant styling with gradient colors and animations
- Implemented `updateModuleSkipUI()` to populate widget with fetched data
- Added `startModuleSkip()` to initiate the skip process

### 4. Module Skip Processing

- **File**: `extension/background/service-worker.ts`
- Added `START_MODULE_SKIP` message type
- Implemented `handleStartModuleSkip()` to:
  - Create a module skip task
  - Fetch module data
  - Track progress
- Implemented `processModuleItems()` to:
  - Iterate through all module items
  - Process each item based on type:
    - **Videos**: Use `Watcher` to mark as watched
    - **Readings**: Use `markReadingComplete()` API call
    - **Quizzes**: Logged (TODO: integrate with solver)
    - **Programming**: Logged (TODO: implement handler)
  - Update progress after each item
  - Handle errors gracefully (continues with remaining items)
  - Notify user on completion
- Added helper methods:
  - `processVideoItem()`: Creates watcher and marks video complete
  - `processReadingItem()`: Marks reading as complete via API

### 5. Message Types

- **File**: `extension/utils/messages.ts`
- Added `START_MODULE_SKIP` message type
- Added `StartModuleSkipMessage` interface with fields:
  - `courseId`: Course identifier
  - `courseSlug`: Course slug for API calls
  - `moduleNumber`: Module number (1-indexed)
- Updated `CourseDetectedMessage` to include "module" item type

### 6. Notifications

- **File**: `extension/utils/notifications.ts`
- Updated `showCompletionNotification()` to support "module" type
- Shows appropriate message when module skip completes

## User Flow

1. **Navigate to Module Page**: User goes to a module URL like:

   ```
   https://www.coursera.org/learn/{course-slug}/home/module/{number}
   ```

2. **Widget Appears**: A floating widget appears in the top-right showing:

   - Module number
   - Loading indicator

3. **Statistics Loaded**: Widget updates to show:

   - Number of videos (📹)
   - Number of readings (📖)
   - Number of quizzes (✍️)
   - Number of programming assignments (💻)
   - Total item count

4. **Click "Skip All Items"**: User clicks the button to start automation

5. **Progress Updates**: Progress modal shows:

   - Current item being processed
   - Progress percentage
   - Live logs of each action

6. **Completion**:
   - Notification appears
   - Page reloads to show updated progress
   - User can continue to next module

## Technical Details

### API Integration

- Uses Coursera's `onDemandCourseMaterials.v2` API
- Fetches modules, lessons, and items with full metadata
- Parses item types from `contentSummary.typeName` field

### Item Type Detection

Maps Coursera's content types to our categories:

- `exam`, `quiz` → quiz
- `lecture`, `video` → video
- `supplement`, `reading` → reading
- `programming` → programming
- `peer` → peer-review

### Error Handling

- Gracefully handles missing module data
- Continues processing if individual items fail
- Shows appropriate error messages to user
- Logs all errors for debugging

## TODO / Future Enhancements

1. **Quiz Integration**: Connect module skip to the existing `GradedSolver` for automatic quiz completion
2. **Programming Assignments**: Implement handler for programming assignments
3. **Peer Reviews**: Add support for peer review items
4. **Selective Skip**: Allow users to choose which item types to skip
5. **Dry Run Mode**: Preview what will be skipped before executing
6. **Better Error Recovery**: Retry failed items automatically
7. **Progress Persistence**: Save progress if user closes tab mid-process

## Files Modified

1. `extension/utils/course-detection.ts` - Module detection
2. `extension/utils/coursera-api.ts` - Module data fetching
3. `extension/content/content-script.ts` - UI and user interaction
4. `extension/background/service-worker.ts` - Processing logic
5. `extension/utils/messages.ts` - Message types
6. `extension/utils/notifications.ts` - Notification support

## Testing Checklist

- [ ] Navigate to module page and verify widget appears
- [ ] Verify item counts match actual module content
- [ ] Test skipping videos (should use watcher)
- [ ] Test skipping readings (should mark complete)
- [ ] Verify progress updates correctly
- [ ] Test error handling (invalid module number)
- [ ] Verify page reload after completion
- [ ] Test with different modules (varying item counts)
- [ ] Verify notifications work correctly
