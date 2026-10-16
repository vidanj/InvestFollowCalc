import { describe, expect, it } from 'vitest';
import { RepositoryError } from '../../db/repository';
import { strings } from '../../i18n/es-MX';
import { errorMessages, issueMessages } from '../errors';

describe('errorMessages', () => {
  it('explains each validation issue once', () => {
    const error = new RepositoryError('INVALID_EVENT', [
      { code: 'INVALID_AMOUNT', eventId: 'a' },
      { code: 'INVALID_AMOUNT', eventId: 'b' },
      { code: 'INVALID_DATE', eventId: 'a' },
    ]);
    expect(errorMessages(error)).toEqual([
      strings.errors.issue('INVALID_AMOUNT'),
      strings.errors.issue('INVALID_DATE'),
    ]);
  });

  it('explains repository errors without issues', () => {
    expect(errorMessages(new RepositoryError('CANNOT_DELETE_INITIAL'))).toEqual([
      strings.errors.repository('CANNOT_DELETE_INITIAL'),
    ]);
  });

  it('falls back to a generic message for unexpected errors', () => {
    expect(errorMessages(new Error('boom'))).toEqual([strings.errors.unexpected]);
    expect(issueMessages([])).toEqual([]);
  });
});
