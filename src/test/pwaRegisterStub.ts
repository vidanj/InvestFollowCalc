// Test stand-in for `virtual:pwa-register/react`, which only exists inside a Vite build.
// Tests can override it with vi.mock('virtual:pwa-register/react', ...).
import { useState } from 'react';

export function useRegisterSW() {
  return {
    needRefresh: useState(false),
    offlineReady: useState(false),
    updateServiceWorker: () => Promise.resolve(),
  };
}
