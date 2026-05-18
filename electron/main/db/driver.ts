import type {
  ConnectionConfig,
  QueryResult,
  SchemaDatabase,
  SchemaTable
} from '@shared/types';

export interface Driver {
  connect(cfg: ConnectionConfig): Promise<{ serverVersion: string }>;
  disconnect(): Promise<void>;
  run(query: string, opts?: { signal?: AbortSignal; database?: string | null }): Promise<QueryResult>;
  introspect(): Promise<SchemaDatabase[]>;
  sample(table: SchemaTable, limit?: number): Promise<QueryResult>;
}
