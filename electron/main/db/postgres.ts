import pg from 'pg';
import type { Driver } from './driver';
import type {
  ColumnMeta,
  ColumnType,
  ConnectionConfig,
  EditableSource,
  QueryResult,
  RowUpdate,
  SchemaDatabase,
  SchemaTable,
  UpdateResult
} from '@shared/types';

const TYPE_MAP: Record<number, ColumnType> = {
  16: 'boolean',
  20: 'number',
  21: 'number',
  23: 'number',
  700: 'number',
  701: 'number',
  1700: 'number',
  1082: 'date',
  1083: 'date',
  1114: 'date',
  1184: 'date',
  114: 'json',
  3802: 'json'
};

function mapType(oid: number): ColumnType {
  return TYPE_MAP[oid] ?? 'string';
}

export class PostgresDriver implements Driver {
  private pool: pg.Pool | null = null;
  private cfg: ConnectionConfig | null = null;

  async connect(cfg: ConnectionConfig): Promise<{ serverVersion: string }> {
    this.cfg = cfg;
    this.pool = new pg.Pool({
      host: cfg.host,
      port: cfg.port,
      database: cfg.database,
      user: cfg.username,
      password: cfg.password,
      ssl: cfg.ssl ? { rejectUnauthorized: false } : undefined,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000
    });
    const res = await this.pool.query('SELECT version() as v');
    return { serverVersion: String(res.rows[0]?.v ?? 'postgres') };
  }

  async disconnect(): Promise<void> {
    await this.pool?.end();
    this.pool = null;
  }

  async run(
    query: string,
    opts: { signal?: AbortSignal; database?: string | null } = {}
  ): Promise<QueryResult> {
    if (!this.pool) throw new Error('Not connected');
    const { signal, database } = opts;
    const client = await this.pool.connect();
    const start = performance.now();
    const onAbort = () =>
      client.query('SELECT pg_cancel_backend(pg_backend_pid())').catch(() => {});
    signal?.addEventListener('abort', onAbort, { once: true });
    try {
      if (database) {
        const safe = database.replace(/"/g, '""');
        await client.query(`SET search_path TO "${safe}", public`).catch(() => {});
      }
      const res = await client.query({ text: query, rowMode: 'array' });
      const fields = res.fields ?? [];
      const columns: ColumnMeta[] = fields.map((f) => ({
        name: f.name,
        type: mapType(f.dataTypeID),
        dbType: String(f.dataTypeID)
      }));
      await annotatePgColumns(client, fields, columns);
      const editable = deriveEditable(columns);
      const rows = (res.rows as unknown[][]).map((row) => {
        const obj: Record<string, unknown> = {};
        columns.forEach((c, i) => {
          obj[c.name] = normalize(row[i]);
        });
        return obj;
      });
      return {
        columns,
        rows,
        rowCount: rows.length,
        affectedRows: res.rowCount ?? undefined,
        durationMs: Math.round(performance.now() - start),
        query,
        editable
      };
    } finally {
      signal?.removeEventListener('abort', onAbort);
      client.release();
    }
  }

  async introspect(): Promise<SchemaDatabase[]> {
    if (!this.pool) throw new Error('Not connected');

    const dbRow = await this.pool
      .query<{ d: string }>('SELECT current_database() as d')
      .catch(() => ({ rows: [] as { d: string }[] }));
    const dbName = dbRow.rows[0]?.d ?? this.cfg?.database ?? 'postgres';

    const tables = await this.pool.query<{
      table_schema: string;
      table_name: string;
      table_type: string;
    }>(
      `SELECT table_schema, table_name, table_type
         FROM information_schema.tables
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
          AND table_schema NOT LIKE 'pg\\_%' ESCAPE '\\'
        ORDER BY table_schema, table_name`
    );
    const cols = await this.pool.query<{
      table_schema: string;
      table_name: string;
      column_name: string;
      data_type: string;
      is_nullable: string;
    }>(
      `SELECT table_schema, table_name, column_name, data_type, is_nullable
         FROM information_schema.columns
        WHERE table_schema NOT IN ('pg_catalog','information_schema')
          AND table_schema NOT LIKE 'pg\\_%' ESCAPE '\\'`
    );
    const colMap = new Map<string, ColumnMeta[]>();
    for (const c of cols.rows) {
      const key = `${c.table_schema}.${c.table_name}`;
      const list = colMap.get(key) ?? [];
      list.push({
        name: c.column_name,
        type: mapPgType(c.data_type),
        dbType: c.data_type,
        nullable: c.is_nullable === 'YES'
      });
      colMap.set(key, list);
    }
    const allTables: SchemaTable[] = tables.rows.map((t) => ({
      name: t.table_name,
      schema: t.table_schema,
      kind: t.table_type === 'VIEW' ? 'view' : 'table',
      columns: colMap.get(`${t.table_schema}.${t.table_name}`) ?? []
    }));

    const others = await this.pool
      .query<{ datname: string }>(
        `SELECT datname FROM pg_database
          WHERE datistemplate = false
            AND datname <> $1
            AND datname NOT IN ('postgres')
          ORDER BY datname
          LIMIT 30`,
        [dbName]
      )
      .catch(() => ({ rows: [] as { datname: string }[] }));

    return [
      { name: dbName, tables: allTables },
      ...others.rows.map((r) => ({ name: r.datname, tables: [] as SchemaTable[] }))
    ];
  }

  async sample(table: SchemaTable, limit = 100): Promise<QueryResult> {
    const ident = `"${(table.schema ?? 'public').replace(/"/g, '""')}"."${table.name.replace(
      /"/g,
      '""'
    )}"`;
    return this.run(`SELECT * FROM ${ident} LIMIT ${limit}`);
  }

  async update(payload: RowUpdate): Promise<UpdateResult> {
    if (!this.pool) throw new Error('Not connected');
    const changeKeys = Object.keys(payload.changes);
    const idKeys = Object.keys(payload.identity);
    if (changeKeys.length === 0) return { affectedRows: 0 };
    if (idKeys.length === 0) {
      throw new Error('Cannot update row: no primary key columns supplied');
    }
    const ident = qualifyPg(payload.schema, payload.table);
    const params: unknown[] = [];
    const setClause = changeKeys
      .map((k) => {
        params.push(normalizeParam(payload.changes[k]));
        return `${quotePg(k)} = $${params.length}`;
      })
      .join(', ');
    const whereClause = idKeys
      .map((k) => {
        params.push(normalizeParam(payload.identity[k]));
        return `${quotePg(k)} = $${params.length}`;
      })
      .join(' AND ');
    const sql = `UPDATE ${ident} SET ${setClause} WHERE ${whereClause}`;
    const res = await this.pool.query(sql, params);
    return { affectedRows: res.rowCount ?? 0 };
  }
}

async function annotatePgColumns(
  client: pg.PoolClient,
  fields: pg.FieldDef[],
  columns: ColumnMeta[]
): Promise<void> {
  const tableIds = new Set<number>();
  for (const f of fields) {
    if (f.tableID && f.tableID > 0) tableIds.add(f.tableID);
  }
  if (tableIds.size === 0) return;
  const ids = Array.from(tableIds);
  let tableRows: Array<{ oid: number; schema: string; name: string }> = [];
  let colRows: Array<{ oid: number; attnum: number; attname: string }> = [];
  let pkRows: Array<{ oid: number; attnum: number }> = [];
  try {
    const t = await client.query<{ oid: string; schema: string; name: string }>(
      `SELECT c.oid::int AS oid, n.nspname AS schema, c.relname AS name
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.oid = ANY($1::oid[])`,
      [ids]
    );
    tableRows = t.rows.map((r) => ({ oid: Number(r.oid), schema: r.schema, name: r.name }));
    const a = await client.query<{ oid: string; attnum: number; attname: string }>(
      `SELECT attrelid::int AS oid, attnum, attname
         FROM pg_attribute
        WHERE attrelid = ANY($1::oid[]) AND attnum > 0 AND NOT attisdropped`,
      [ids]
    );
    colRows = a.rows.map((r) => ({ oid: Number(r.oid), attnum: r.attnum, attname: r.attname }));
    const p = await client.query<{ oid: string; attnum: number }>(
      `SELECT i.indrelid::int AS oid, k.attnum
         FROM pg_index i, unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
        WHERE i.indrelid = ANY($1::oid[]) AND i.indisprimary`,
      [ids]
    );
    pkRows = p.rows.map((r) => ({ oid: Number(r.oid), attnum: r.attnum }));
  } catch {
    return;
  }
  const tableById = new Map(tableRows.map((r) => [r.oid, r]));
  const colByKey = new Map(colRows.map((r) => [`${r.oid}:${r.attnum}`, r.attname]));
  const pkSet = new Set(pkRows.map((r) => `${r.oid}:${r.attnum}`));
  fields.forEach((f, i) => {
    const oid = f.tableID;
    const attnum = f.columnID;
    if (!oid || !attnum) return;
    const t = tableById.get(oid);
    if (t) {
      columns[i].sourceSchema = t.schema;
      columns[i].sourceTable = t.name;
    }
    const name = colByKey.get(`${oid}:${attnum}`);
    if (name) columns[i].sourceColumn = name;
    columns[i].isPrimaryKey = pkSet.has(`${oid}:${attnum}`);
  });
}

function deriveEditable(columns: ColumnMeta[]): EditableSource | undefined {
  const tables = new Set<string>();
  const schemas = new Set<string>();
  for (const c of columns) {
    if (c.sourceTable) tables.add(c.sourceTable);
    if (c.sourceSchema) schemas.add(c.sourceSchema);
  }
  if (tables.size !== 1) return undefined;
  const [table] = tables;
  const schema = schemas.size === 1 ? Array.from(schemas)[0] : undefined;
  const pk = columns
    .filter((c) => c.isPrimaryKey && c.sourceColumn)
    .map((c) => c.sourceColumn as string);
  if (pk.length === 0) return undefined;
  return { schema, table, primaryKey: pk };
}

function quotePg(ident: string): string {
  return `"${ident.replace(/"/g, '""')}"`;
}

function qualifyPg(schema: string | undefined, table: string): string {
  return schema ? `${quotePg(schema)}.${quotePg(table)}` : quotePg(table);
}

function normalizeParam(v: unknown): unknown {
  if (v === undefined) return null;
  if (v !== null && typeof v === 'object') return JSON.stringify(v);
  return v;
}

function mapPgType(t: string): ColumnType {
  const lower = t.toLowerCase();
  if (lower.includes('int') || lower.includes('numeric') || lower.includes('real') || lower.includes('double')) return 'number';
  if (lower.includes('bool')) return 'boolean';
  if (lower.includes('json')) return 'json';
  if (lower.includes('date') || lower.includes('time')) return 'date';
  return 'string';
}

function normalize(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object' && Buffer.isBuffer(v)) return `\\x${v.toString('hex')}`;
  return v;
}
