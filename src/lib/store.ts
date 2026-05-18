import { create } from 'zustand';
import type {
  AiChatMessage,
  AiSettings,
  ConnectionConfig,
  QueryResult,
  SchemaDatabase
} from '@shared/types';
import { shortId } from './utils';

export type ResultView = 'table' | 'json' | 'chart';

export interface Tab {
  id: string;
  title: string;
  connectionId: string | null;
  activeDb: string | null;
  query: string;
  result: QueryResult | null;
  error: string | null;
  running: boolean;
  view: ResultView;
  ai: AiChatMessage[];
  aiOpen: boolean;
  pendingRun?: boolean;
}

export interface UiState {
  connections: ConnectionConfig[];
  openConnections: Record<string, { serverVersion?: string }>;
  schemas: Record<string, SchemaDatabase[]>;
  tabs: Tab[];
  activeTabId: string | null;
  aiSettings: AiSettings;
  modal: 'connection' | 'settings' | null;
  modalPayload: unknown;
  commandPaletteOpen: boolean;
  toast: { id: string; tone: 'info' | 'success' | 'error'; message: string } | null;
  setConnections: (c: ConnectionConfig[]) => void;
  setAiSettings: (s: AiSettings) => void;
  openConnection: (id: string, info: { serverVersion: string }) => void;
  closeConnection: (id: string) => void;
  setSchema: (id: string, s: SchemaDatabase[]) => void;
  newTab: (init?: Partial<Tab>) => string;
  updateTab: (id: string, patch: Partial<Tab>) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  openModal: (m: 'connection' | 'settings', payload?: unknown) => void;
  closeModal: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  showToast: (tone: 'info' | 'success' | 'error', message: string) => void;
  dismissToast: () => void;
}

export const useApp = create<UiState>((set) => ({
  connections: [],
  openConnections: {},
  schemas: {},
  tabs: [],
  activeTabId: null,
  aiSettings: { providers: {} },
  modal: null,
  modalPayload: null,
  commandPaletteOpen: false,
  toast: null,

  setConnections: (c) => set({ connections: c }),
  setAiSettings: (s) => set({ aiSettings: s }),

  openConnection: (id, info) =>
    set((s) => ({
      openConnections: { ...s.openConnections, [id]: info }
    })),

  closeConnection: (id) =>
    set((s) => {
      const next = { ...s.openConnections };
      delete next[id];
      const schemas = { ...s.schemas };
      delete schemas[id];
      return { openConnections: next, schemas };
    }),

  setSchema: (id, sch) =>
    set((s) => ({ schemas: { ...s.schemas, [id]: sch } })),

  newTab: (init = {}) => {
    const id = shortId();
    const tab: Tab = {
      id,
      title: init.title ?? 'Untitled',
      connectionId: init.connectionId ?? null,
      activeDb: init.activeDb ?? null,
      query: init.query ?? '',
      result: null,
      error: null,
      running: false,
      view: 'table',
      ai: [],
      aiOpen: false,
      pendingRun: init.pendingRun ?? false,
      ...init
    };
    set((s) => ({ tabs: [...s.tabs, tab], activeTabId: id }));
    return id;
  },

  updateTab: (id, patch) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, ...patch } : t))
    })),

  closeTab: (id) =>
    set((s) => {
      const tabs = s.tabs.filter((t) => t.id !== id);
      const activeTabId =
        s.activeTabId === id ? tabs[tabs.length - 1]?.id ?? null : s.activeTabId;
      return { tabs, activeTabId };
    }),

  setActiveTab: (id) => set({ activeTabId: id }),

  openModal: (m, payload) => set({ modal: m, modalPayload: payload ?? null }),
  closeModal: () => set({ modal: null, modalPayload: null }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  showToast: (tone, message) => set({ toast: { id: shortId(), tone, message } }),
  dismissToast: () => set({ toast: null })
}));
