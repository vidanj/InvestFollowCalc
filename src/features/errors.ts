import { RepositoryError } from '../db/repository';
import type { ValidationIssue } from '../domain/validation';
import { strings } from '../i18n/es-MX';

/** Unique, user-facing messages for a list of validation issues. */
export function issueMessages(issues: readonly ValidationIssue[]): string[] {
  return [...new Set(issues.map((issue) => strings.errors.issue(issue.code)))];
}

/** User-facing messages for anything a repository write can throw. */
export function errorMessages(error: unknown): string[] {
  if (error instanceof RepositoryError) {
    return error.issues.length > 0
      ? issueMessages(error.issues)
      : [strings.errors.repository(error.code)];
  }
  return [strings.errors.unexpected];
}
