import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '@shared/ipc-channels';
import type {
  AiSettings,
  ConnectionConfig,
  QueryResult,
  SchemaDatabase,
  SchemaTable,
  AiQueryResponse
} from '@shared/types';

const api = {
  platform: () => ipcRenderer.invoke(IPC.app.platform) as Promise<NodeJS.Platform>,
  openExternal: (url: string) => ipcRenderer.invoke(IPC.app.openExternal, url) as Promise<void>,
  connections: {
    list: () => ipcRenderer.invoke(IPC.connections.list) as Promise<ConnectionConfig[]>,
    save: (cfg: ConnectionConfig) =>
      ipcRenderer.invoke(IPC.connections.save, cfg) as Promise<ConnectionConfig[]>,
    delete: (id: string) =>
      ipcRenderer.invoke(IPC.connections.delete, id) as Promise<ConnectionConfig[]>,
    test: (cfg: ConnectionConfig) =>
      ipcRenderer.invoke(IPC.connections.test, cfg) as Promise<{ serverVersion: string }>,
    open: (id: string) =>
      ipcRenderer.invoke(IPC.connections.open, id) as Promise<{ serverVersion: string }>,
    close: (id: string) =>
      ipcRenderer.invoke(IPC.connections.close, id) as Promise<{ closed: boolean }>,
    status: (id: string) =>
      ipcRenderer.invoke(IPC.connections.status, id) as Promise<{ connected: boolean }>
  },
  query: {
    run: (id: string, query: string, database?: string | null) =>
      ipcRenderer.invoke(IPC.query.run, { id, query, database }) as Promise<QueryResult>,
    cancel: (id: string) =>
      ipcRenderer.invoke(IPC.query.cancel, id) as Promise<{ cancelled: boolean }>
  },
  schema: {
    introspect: (id: string) =>
      ipcRenderer.invoke(IPC.schema.introspect, id) as Promise<SchemaDatabase[]>,
    sample: (id: string, table: SchemaTable, limit?: number) =>
      ipcRenderer.invoke(IPC.schema.sample, { id, table, limit }) as Promise<QueryResult>
  },
  ai: {
    settings: () => ipcRenderer.invoke(IPC.ai.settings) as Promise<AiSettings>,
    saveSettings: (s: AiSettings) =>
      ipcRenderer.invoke(IPC.ai.saveSettings, s) as Promise<AiSettings>,
    generateQuery: (
      connectionId: string,
      prompt: string,
      history?: Array<{ role: 'user' | 'assistant'; content: string }>
    ) =>
      ipcRenderer.invoke(IPC.ai.generateQuery, {
        connectionId,
        prompt,
        history
      }) as Promise<AiQueryResponse>
  }
};

contextBridge.exposeInMainWorld('sadb', api);

export type SadbApi = typeof api;
