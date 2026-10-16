import { useLiveQuery } from 'dexie-react-hooks';
import type { AccountWithEvents } from './repository';
import { useRepository } from './repositoryContext';
import type { AccountRecord, EventRecord } from './schema';

// Live queries re-render automatically when the underlying data changes.
// `undefined` means "still loading"; `null` means "not found".

export function useAccountsWithEvents(): AccountWithEvents[] | undefined {
  const repository = useRepository();
  return useLiveQuery(() => repository.listAccountsWithEvents(), [repository]);
}

export function useAccount(id: string): AccountRecord | null | undefined {
  const repository = useRepository();
  return useLiveQuery(async () => (await repository.getAccount(id)) ?? null, [repository, id]);
}

export function useAccountEvents(accountId: string): EventRecord[] | undefined {
  const repository = useRepository();
  return useLiveQuery(() => repository.listEvents(accountId), [repository, accountId]);
}
