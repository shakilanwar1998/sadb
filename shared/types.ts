export type DbKind = 'postgres' | 'mysql' | 'mongodb';

export interface ConnectionConfig {
  id: string;
  name: string;
  kind: DbKind;
  host: string;
  port: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  uri?: string;
  color?: string;
  createdAt: number;
}

export interface ConnectionStatus {
  id: string;
  connected: boolean;
  serverVersion?: string;
  error?: string;
}

export type ColumnType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'json'
  | 'unknown';

export interface ColumnMeta {
  name: string;
  type: ColumnType;
  dbType?: string;
  nullable?: boolean;
  sourceSchema?: string;
  sourceTable?: string;
  sourceColumn?: string;
  isPrimaryKey?: boolean;
}

export interface EditableSource {
  schema?: string;
  table: string;
  primaryKey: string[];
}

export interface QueryResult {
  columns: ColumnMeta[];
  rows: Array<Record<string, unknown>>;
  rowCount: number;
  durationMs: number;
  query: string;
  affectedRows?: number;
  warning?: string;
  editable?: EditableSource;
}

export interface RowUpdate {
  schema?: string;
  table: string;
  identity: Record<string, unknown>;
  changes: Record<string, unknown>;
}

export interface UpdateResult {
  affectedRows: number;
}

export interface QueryError {
  message: string;
  code?: string;
  position?: number;
}

export interface SchemaTable {
  name: string;
  schema?: string;
  kind: 'table' | 'view' | 'collection';
  rowCount?: number;
  columns?: ColumnMeta[];
}

export interface SchemaDatabase {
  name: string;
  tables: SchemaTable[];
}

export type AiProvider = 'anthropic' | 'openai' | 'gemini';

export interface AiProviderConfig {
  provider: AiProvider;
  apiKey: string;
  model: string;
}

export interface AiSettings {
  providers: Partial<Record<AiProvider, { apiKey: string; model: string }>>;
  active?: AiProvider;
}

export interface AiQueryResponse {
  reasoning?: string;
  sql: string;
  notes?: string;
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sql?: string;
  result?: QueryResult;
  error?: string;
  createdAt: number;
}

export const AI_MODELS: Record<AiProvider, string[]> = {
  anthropic: [
    'claude-opus-4-7',
    'claude-sonnet-4-6',
    'claude-haiku-4-5-20251001'
  ],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'o3-mini'],
  gemini: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash']
};
