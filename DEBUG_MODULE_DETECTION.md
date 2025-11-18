# Module Detection Debug Guide

## Steps to Debug

1. **Reload the extension** in Chrome:

   - Go to `chrome://extensions`
   - Find "Coursera Skipper"
   - Click the refresh icon

2. **Navigate to a module page**:

   - Go to: `https://www.coursera.org/learn/aws-cloud-technical-essentials/home/module/3`

3. **Open DevTools Console** (F12)

4. **Look for these log messages**:

### Expected Log Sequence:

```
[Coursera Skipper] Content script loaded
[Coursera Skipper] Auth info saved
[Course Detection] isModulePage check: {url: "...", isModule: true, pathname: "..."}
[Course Detection] Module URL detected: {url: "...", match: [...], courseSlug: "..."}
[Course Detection] Module info extracted: {courseId: "...", itemId: "module-3", itemType: "module", url: "...", moduleNumber: 3}
[Coursera Skipper] Module page detected
[Coursera Skipper] Current URL: ...
[Coursera Skipper] Course info: {courseId: "...", itemId: "module-3", ...}
[CourseraAPI] Fetching module data: {courseSlug: "...", moduleNumber: 3}
[CourseraAPI] Course data received: {hasModules: true, moduleCount: X}
[Coursera Skipper] Module data: {moduleId: "...", name: "...", items: [...], counts: {...}}
```

## If You See:

### ✅ "Module page detected" but no widget appears

- Check if the widget HTML is being created
- Look for CSS styling issues
- Check browser console for errors

### ❌ No "Module page detected" message

The issue is in URL detection. Check:

- Is `isModulePage()` returning `true`?
- Is `detectCourseInfo()` finding the module?

### ❌ "Could not detect module number"

The URL pattern isn't matching. Share:

- The exact URL you're on
- What the logs show for the regex match

### ❌ "Could not fetch module data"

The API call failed. Check:

- Network tab for failed requests
- The course data structure might be different

## Manual Console Test

Open the console and run:

```javascript
// Test URL detection
console.log("Current URL:", window.location.href);
console.log(
  "Includes /home/module/:",
  window.location.href.includes("/home/module/")
);

// Test regex
const match = window.location.href.match(/\/home\/module\/(\d+)/);
console.log("Regex match:", match);

// Check for module page
const isModule = window.location.href.includes("/home/module/");
console.log("Is module page:", isModule);
```

## Common Issues

1. **URL doesn't contain /home/module/**

   - Coursera might use a different URL structure
   - Check the actual URL pattern in your browser

2. **Extension not loading on Coursera**

   - Check manifest.json has correct permissions
   - Check content_scripts matches Coursera URLs

3. **No console logs at all**
   - Extension might not be loaded
   - Check if content script is injected
   - Try refreshing the page

## What to Share

If it's still not working, please share:

1. The exact URL you're visiting
2. All console log output (screenshot or copy/paste)
3. Any errors in the console (red text)
4. Network tab showing any failed API requests
