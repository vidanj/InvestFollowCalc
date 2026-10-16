import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { Repository, type Clock } from '../db/repository';
import { RepositoryProvider } from '../db/RepositoryProvider';
import { createDb } from '../db/schema';
import { addDays, toIsoDate } from '../domain/dates';
import { AppRoutes } from '../routes';

/** A repository backed by a fresh, isolated in-memory IndexedDB database. */
export function createTestRepository(clock?: Clock): Repository {
  return new Repository(createDb(`test-${crypto.randomUUID()}`), clock);
}

/** Renders the app routes starting at `path`. */
export function renderRoute(path: string, repository: Repository = createTestRepository()) {
  const user = userEvent.setup();
  const utils = render(
    <RepositoryProvider repository={repository}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </RepositoryProvider>,
  );
  return { user, repository, ...utils };
}

/** Local date `days` before today (forms reject future dates). */
export function daysAgo(days: number): string {
  return addDays(toIsoDate(), -days);
}
