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
    | "unknown";
  url: string;
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
