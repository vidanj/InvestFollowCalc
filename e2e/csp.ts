import type { Page } from '@playwright/test';

/**
 * Collects every CSP violation of the page, across reloads and navigations, in Node memory.
 * Call before the first `page.goto`.
 */
export async function trackCspViolations(page: Page): Promise<string[]> {
  const violations: string[] = [];
  await page.exposeFunction('__reportCspViolation', (violation: string) => {
    violations.push(violation);
  });
  page.on('console', (message) => {
    if (/Content Security Policy/i.test(message.text())) violations.push(message.text());
  });
  await page.addInitScript({
    content: `document.addEventListener('securitypolicyviolation', (e) =>
      window.__reportCspViolation(e.violatedDirective + ' ' + e.blockedURI));`,
  });
  return violations;
}
