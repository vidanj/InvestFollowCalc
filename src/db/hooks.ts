import { useLiveQuery } from 'dexie-react-hooks';
import type { AccountWithEvents } from './repository';
import { useRepository } from './repositoryContext';
import type { AccountRecord, BudgetItemRecord, CreditRecord, EventRecord, MetaKey } from './schema';

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

export function useMeta(key: MetaKey): string | null | undefined {
  const repository = useRepository();
  return useLiveQuery(async () => (await repository.getMeta(key)) ?? null, [repository, key]);
}

export function useBudgetItems(): BudgetItemRecord[] | undefined {
  const repository = useRepository();
  return useLiveQuery(() => repository.listBudgetItems(), [repository]);
}

export function useBudgetItem(id: string): BudgetItemRecord | null | undefined {
  const repository = useRepository();
  return useLiveQuery(async () => (await repository.getBudgetItem(id)) ?? null, [repository, id]);
}

export function useCredits(): CreditRecord[] | undefined {
  const repository = useRepository();
  return useLiveQuery(() => repository.listCredits(), [repository]);
}

export function useCredit(id: string): CreditRecord | null | undefined {
  const repository = useRepository();
  return useLiveQuery(async () => (await repository.getCredit(id)) ?? null, [repository, id]);
}

/** Whether anything at all is stored (accounts, budget or credits). */
export function useHasData(): boolean | undefined {
  const repository = useRepository();
  return useLiveQuery(() => repository.hasData(), [repository]);
}
