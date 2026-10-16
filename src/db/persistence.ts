/**
 * Asks the browser not to evict this site's storage under pressure. Browsers may grant it
 * silently, ask the user, or refuse; data still works without it, but backups matter more.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !('storage' in navigator)) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
