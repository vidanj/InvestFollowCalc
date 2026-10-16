import { createContext, useContext } from 'react';
import type { Repository } from './repository';

export const RepositoryContext = createContext<Repository | null>(null);

export function useRepository(): Repository {
  const repository = useContext(RepositoryContext);
  if (!repository) throw new Error('useRepository must be used inside <RepositoryProvider>');
  return repository;
}
