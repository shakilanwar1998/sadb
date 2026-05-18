import { app, safeStorage } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ConnectionConfig, AiSettings } from '@shared/types';

interface PersistedShape {
  connections: ConnectionConfig[];
  ai: AiSettings;
}

const DEFAULT: PersistedShape = {
  connections: [],
  ai: { providers: {} }
};

let cache: PersistedShape | null = null;

function storePath(): string {
  return path.join(app.getPath('userData'), 'sadb-store.json');
}

function isEncryptionAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

function encrypt(value: string): string {
  if (!value) return '';
  if (!isEncryptionAvailable()) return `plain:${value}`;
  return `enc:${safeStorage.encryptString(value).toString('base64')}`;
}

function decrypt(value: string | undefined): string {
  if (!value) return '';
  if (value.startsWith('plain:')) return value.slice(6);
  if (value.startsWith('enc:')) {
    try {
      return safeStorage.decryptString(Buffer.from(value.slice(4), 'base64'));
    } catch {
      return '';
    }
  }
  return value;
}

function encodeConnection(c: ConnectionConfig): ConnectionConfig {
  return {
    ...c,
    password: c.password ? encrypt(c.password) : '',
    uri: c.uri ? encrypt(c.uri) : ''
  };
}

function decodeConnection(c: ConnectionConfig): ConnectionConfig {
  return {
    ...c,
    password: c.password ? decrypt(c.password) : '',
    uri: c.uri ? decrypt(c.uri) : ''
  };
}

function encodeAi(ai: AiSettings): AiSettings {
  const providers: AiSettings['providers'] = {};
  for (const [k, v] of Object.entries(ai.providers)) {
    if (!v) continue;
    providers[k as keyof AiSettings['providers']] = {
      apiKey: encrypt(v.apiKey),
      model: v.model
    };
  }
  return { ...ai, providers };
}

function decodeAi(ai: AiSettings): AiSettings {
  const providers: AiSettings['providers'] = {};
  for (const [k, v] of Object.entries(ai.providers)) {
    if (!v) continue;
    providers[k as keyof AiSettings['providers']] = {
      apiKey: decrypt(v.apiKey),
      model: v.model
    };
  }
  return { ...ai, providers };
}

async function load(): Promise<PersistedShape> {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(storePath(), 'utf-8');
    const parsed = JSON.parse(raw) as PersistedShape;
    cache = {
      connections: (parsed.connections ?? []).map(decodeConnection),
      ai: decodeAi(parsed.ai ?? { providers: {} })
    };
  } catch {
    cache = structuredClone(DEFAULT);
  }
  return cache;
}

async function persist(): Promise<void> {
  if (!cache) return;
  const out: PersistedShape = {
    connections: cache.connections.map(encodeConnection),
    ai: encodeAi(cache.ai)
  };
  await fs.mkdir(path.dirname(storePath()), { recursive: true });
  await fs.writeFile(storePath(), JSON.stringify(out, null, 2), 'utf-8');
}

export const store = {
  async listConnections(): Promise<ConnectionConfig[]> {
    const data = await load();
    return data.connections.map((c) => ({ ...c, password: '', uri: '' }));
  },
  async getConnection(id: string): Promise<ConnectionConfig | null> {
    const data = await load();
    return data.connections.find((c) => c.id === id) ?? null;
  },
  async saveConnection(c: ConnectionConfig): Promise<void> {
    const data = await load();
    const idx = data.connections.findIndex((x) => x.id === c.id);
    if (idx >= 0) {
      const existing = data.connections[idx];
      data.connections[idx] = {
        ...c,
        password: c.password || existing.password,
        uri: c.uri || existing.uri
      };
    } else {
      data.connections.push(c);
    }
    await persist();
  },
  async deleteConnection(id: string): Promise<void> {
    const data = await load();
    data.connections = data.connections.filter((c) => c.id !== id);
    await persist();
  },
  async getAi(): Promise<AiSettings> {
    const data = await load();
    return data.ai;
  },
  async saveAi(ai: AiSettings): Promise<void> {
    const data = await load();
    data.ai = ai;
    await persist();
  }
};
