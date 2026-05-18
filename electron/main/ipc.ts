import { ipcMain, shell } from 'electron';
import { IPC } from '@shared/ipc-channels';
import type {
  AiSettings,
  ConnectionConfig,
  SchemaTable
} from '@shared/types';
import { connections } from './db';
import { store } from './store';
import { generateQuery } from './ai';

export function registerIpc(): void {
  // ---------- connections ----------
  ipcMain.handle(IPC.connections.list, async () => store.listConnections());

  ipcMain.handle(IPC.connections.save, async (_e, cfg: ConnectionConfig) => {
    await store.saveConnection(cfg);
    return store.listConnections();
  });

  ipcMain.handle(IPC.connections.delete, async (_e, id: string) => {
    await connections.close(id);
    await store.deleteConnection(id);
    return store.listConnections();
  });

  ipcMain.handle(IPC.connections.test, async (_e, cfg: ConnectionConfig) => {
    const full = cfg.id ? (await store.getConnection(cfg.id)) ?? cfg : cfg;
    const merged: ConnectionConfig = {
      ...full,
      ...cfg,
      password: cfg.password || full.password,
      uri: cfg.uri || full.uri
    };
    return connections.test(merged);
  });

  ipcMain.handle(IPC.connections.open, async (_e, id: string) => {
    const cfg = await store.getConnection(id);
    if (!cfg) throw new Error('Connection not found');
    return connections.open(cfg);
  });

  ipcMain.handle(IPC.connections.close, async (_e, id: string) => {
    await connections.close(id);
    return { closed: true };
  });

  ipcMain.handle(IPC.connections.status, async (_e, id: string) => ({
    connected: connections.has(id)
  }));

  // ---------- query ----------
  ipcMain.handle(
    IPC.query.run,
    async (
      _e,
      args: { id: string; query: string; database?: string | null }
    ) => {
      const driver = connections.get(args.id);
      if (!driver) throw new Error('Open the connection before running queries');
      const ac = connections.signal(args.id);
      return driver.run(args.query, { signal: ac.signal, database: args.database ?? null });
    }
  );

  ipcMain.handle(IPC.query.cancel, async (_e, id: string) => {
    connections.cancel(id);
    return { cancelled: true };
  });

  // ---------- schema ----------
  ipcMain.handle(IPC.schema.introspect, async (_e, id: string) => {
    const driver = connections.get(id);
    if (!driver) throw new Error('Open the connection first');
    return driver.introspect();
  });

  ipcMain.handle(
    IPC.schema.sample,
    async (_e, args: { id: string; table: SchemaTable; limit?: number }) => {
      const driver = connections.get(args.id);
      if (!driver) throw new Error('Open the connection first');
      return driver.sample(args.table, args.limit);
    }
  );

  // ---------- ai ----------
  ipcMain.handle(IPC.ai.settings, async () => store.getAi());

  ipcMain.handle(IPC.ai.saveSettings, async (_e, ai: AiSettings) => {
    await store.saveAi(ai);
    return store.getAi();
  });

  ipcMain.handle(
    IPC.ai.generateQuery,
    async (
      _e,
      args: {
        connectionId: string;
        prompt: string;
        history?: Array<{ role: 'user' | 'assistant'; content: string }>;
      }
    ) => {
      const settings = await store.getAi();
      const provider = settings.active;
      if (!provider) throw new Error('Configure an AI provider in Settings → AI');
      const cfg = settings.providers[provider];
      if (!cfg?.apiKey) throw new Error(`Missing API key for ${provider}`);
      const conn = await store.getConnection(args.connectionId);
      if (!conn) throw new Error('Connection not found');
      const driver = connections.get(args.connectionId);
      const schema = driver ? await driver.introspect().catch(() => []) : [];
      return generateQuery({
        provider,
        apiKey: cfg.apiKey,
        model: cfg.model,
        prompt: args.prompt,
        dbKind: conn.kind,
        schema,
        history: args.history
      });
    }
  );

  // ---------- app ----------
  ipcMain.handle(IPC.app.platform, () => process.platform);
  ipcMain.handle(IPC.app.openExternal, async (_e, url: string) => {
    if (!/^https?:\/\//.test(url)) throw new Error('Only http(s) URLs allowed');
    await shell.openExternal(url);
  });
}
