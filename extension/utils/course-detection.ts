/**
 * Course Detection Utility
 * Detects and extracts course information from Coursera pages
 */

export interface CourseInfo {
  courseId: string;
  itemId: string;
  itemType:
    | "quiz"
    | "video"
    | "reading"
    | "programming"
    | "peer-review"
    | "module"
    | "unknown";
  url: string;
  moduleNumber?: number; // For module pages
}

/**
 * Extract course information from current URL
 */
export function detectCourseInfo(): CourseInfo | null {
  const url = window.location.href;

  // Pattern: https://www.coursera.org/learn/{course-slug}/...
  const coursePattern = /coursera\.org\/learn\/([^\/]+)/;
  const courseMatch = url.match(coursePattern);

  if (!courseMatch) {
    return null;
  }

  const courseSlug = courseMatch[1];

  // Extract item type and ID from URL patterns
  let itemType: CourseInfo["itemType"] = "unknown";
  let itemId = "";

  // Quiz/Exam: /exam/{itemId}/
  if (url.includes("/exam/")) {
    itemType = "quiz";
    const match = url.match(/\/exam\/([^\/]+)/);
    itemId = match ? match[1] : "";
  }
  // Programming assignment: /programming/{itemId}/
  else if (url.includes("/programming/")) {
    itemType = "programming";
    const match = url.match(/\/programming\/([^\/]+)/);
    itemId = match ? match[1] : "";
  }
  // Peer review: /peer/{itemId}/
  else if (url.includes("/peer/")) {
    itemType = "peer-review";
    const match = url.match(/\/peer\/([^\/]+)/);
    itemId = match ? match[1] : "";
  }
  // Video lecture: /lecture/{itemId}
  else if (url.includes("/lecture/")) {
    itemType = "video";
    const match = url.match(/\/lecture\/([^\/]+)/);
    itemId = match ? match[1] : "";
  }
  // Reading: /supplement/{itemId}
  else if (url.includes("/supplement/")) {
    itemType = "reading";
    const match = url.match(/\/supplement\/([^\/]+)/);
    itemId = match ? match[1] : "";
  }
  // Module: /home/module/{moduleNumber}
  else if (url.includes("/home/module/")) {
    itemType = "module";
    const match = url.match(/\/home\/module\/(\d+)/);
    console.log("[Course Detection] Module URL detected:", {
      url,
      match,
      courseSlug,
    });
    if (match) {
      const moduleNumber = parseInt(match[1]);
      const result = {
        courseId: courseSlug,
        itemId: `module-${moduleNumber}`,
        itemType: "module" as const,
        url,
        moduleNumber,
      };
      console.log("[Course Detection] Module info extracted:", result);
      return result;
    } else {
      console.warn("[Course Detection] Module URL match failed");
    }
  }
  // Generic item: /item/{itemId}
  else if (url.includes("/item/")) {
    const match = url.match(/\/item\/([^\/]+)/);
    itemId = match ? match[1] : "";
  }

  if (!itemId) {
    return null;
  }

  return {
    courseId: courseSlug,
    itemId,
    itemType,
    url,
  };
}

/**
 * Check if current page is a Coursera course page
 */
export function isCourseraCoursePage(): boolean {
  return (
    window.location.hostname.includes("coursera.org") &&
    window.location.pathname.includes("/learn/")
  );
}

/**
 * Check if current page is an actionable course item (not just a module overview)
 */
export function isActionableCourseItem(): boolean {
  const url = window.location.href;
  return (
    url.includes("/exam/") ||
    url.includes("/programming/") ||
    url.includes("/peer/") ||
    url.includes("/lecture/") ||
    url.includes("/supplement/") ||
    url.includes("/item/") ||
    url.includes("/home/module/")
  );
}

/**
 * Check if current page is a module overview page
 */
export function isModulePage(): boolean {
  const url = window.location.href;
  const isModule = url.includes("/home/module/");
  console.log("[Course Detection] isModulePage check:", {
    url,
    isModule,
    pathname: window.location.pathname,
  });
  return isModule;
}

/**
 * Extract CSRF token from cookies or meta tags
 */
export function extractCSRFToken(): string | null {
  // Try to find CSRF token in cookies
  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === "CSRF3-Token") {
      return decodeURIComponent(value);
    }
  }

  // Try to find in meta tags
  const metaTag = document.querySelector('meta[name="csrf-token"]');
  if (metaTag) {
    return metaTag.getAttribute("content");
  }

  return null;
}

/**
 * Extract authentication cookie
 */
export function extractAuthCookie(): string | null {
  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === "CAUTH") {
      return decodeURIComponent(value);
    }
  }
  return null;
}

/**
 * Wait for an element to appear in the DOM
 */
export function waitForElement(
  selector: string,
  timeout: number = 10000
): Promise<Element> {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element ${selector} not found within ${timeout}ms`));
    }, timeout);
  });
}

/**
 * Get course metadata from the page
 */
export function getCourseMetadata(): {
  courseName?: string;
  itemName?: string;
} {
  const metadata: { courseName?: string; itemName?: string } = {};

  // Try to extract course name
  const courseNameElement = document.querySelector(
    '[data-e2e="course-name"], h1.course-name'
  );
  if (courseNameElement) {
    metadata.courseName = courseNameElement.textContent?.trim();
  }

  // Try to extract item name
  const itemNameElement = document.querySelector(
    '[data-e2e="item-name"], h2.item-name'
  );
  if (itemNameElement) {
    metadata.itemName = itemNameElement.textContent?.trim();
  }

  return metadata;
}
