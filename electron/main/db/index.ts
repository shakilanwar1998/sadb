import type { ConnectionConfig, DbKind } from '@shared/types';
import { PostgresDriver } from './postgres';
import { MySqlDriver } from './mysql';
import { MongoDriver } from './mongo';
import type { Driver } from './driver';

export function createDriver(kind: DbKind): Driver {
  switch (kind) {
    case 'postgres':
      return new PostgresDriver();
    case 'mysql':
      return new MySqlDriver();
    case 'mongodb':
      return new MongoDriver();
  }
}

class ConnectionRegistry {
  private drivers = new Map<string, Driver>();
  private signals = new Map<string, AbortController>();

  async open(cfg: ConnectionConfig): Promise<{ serverVersion: string }> {
    await this.close(cfg.id);
    const driver = createDriver(cfg.kind);
    const info = await driver.connect(cfg);
    this.drivers.set(cfg.id, driver);
    return info;
  }

  async close(id: string): Promise<void> {
    const d = this.drivers.get(id);
    if (d) {
      try {
        await d.disconnect();
      } catch {
        /* ignore */
      }
      this.drivers.delete(id);
    }
    this.signals.get(id)?.abort();
    this.signals.delete(id);
  }

  get(id: string): Driver | undefined {
    return this.drivers.get(id);
  }

  has(id: string): boolean {
    return this.drivers.has(id);
  }

  signal(id: string): AbortController {
    let ac = this.signals.get(id);
    if (!ac || ac.signal.aborted) {
      ac = new AbortController();
      this.signals.set(id, ac);
    }
    return ac;
  }

  cancel(id: string): void {
    this.signals.get(id)?.abort();
    this.signals.delete(id);
  }

  async test(cfg: ConnectionConfig): Promise<{ serverVersion: string }> {
    const driver = createDriver(cfg.kind);
    try {
      const info = await driver.connect(cfg);
      return info;
    } finally {
      await driver.disconnect().catch(() => {});
    }
  }
}

export const connections = new ConnectionRegistry();
