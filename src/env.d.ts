/// <reference types="vite/client" />

import type { SadbApi } from '../electron/preload';

declare global {
  interface Window {
    sadb: SadbApi;
  }
}

export {};
