import type { ReactNode } from 'react';
import type { Repository } from './repository';
import { RepositoryContext } from './repositoryContext';

export function RepositoryProvider({
  repository,
  children,
}: {
  repository: Repository;
  children: ReactNode;
}) {
  return <RepositoryContext value={repository}>{children}</RepositoryContext>;
}
