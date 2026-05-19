import mysql from 'mysql2/promise';
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

// mysql2 FieldPacket exposes server-side flags but doesn't type them. Bit 2
// (PRI_KEY_FLAG) marks a column that participates in the source table's PK.
const PRI_KEY_FLAG = 0x2;

const MYSQL_TYPE_CODES: Record<number, ColumnType> = {
  1: 'number', 2: 'number', 3: 'number', 4: 'number', 5: 'number',
  8: 'number', 9: 'number', 246: 'number',
  7: 'date', 10: 'date', 11: 'date', 12: 'date', 13: 'date', 14: 'date',
  245: 'json',
  16: 'boolean'
};

function mapTypeCode(code: number | undefined): ColumnType {
  if (code === undefined) return 'unknown';
  return MYSQL_TYPE_CODES[code] ?? 'string';
}

function mapTypeName(t: string | undefined): ColumnType {
  if (!t) return 'unknown';
  const lower = t.toLowerCase();
  if (['tinyint', 'smallint', 'mediumint', 'int', 'bigint', 'float', 'double', 'decimal'].some((k) => lower.includes(k))) return 'number';
  if (lower.includes('bool')) return 'boolean';
  if (lower.includes('json')) return 'json';
  if (lower.includes('date') || lower.includes('time') || lower.includes('year')) return 'date';
  return 'string';
}

export class MySqlDriver implements Driver {
  private conn: mysql.Connection | null = null;
  private cfg: ConnectionConfig | null = null;

  async connect(cfg: ConnectionConfig): Promise<{ serverVersion: string }> {
    this.cfg = cfg;
    this.conn = await mysql.createConnection({
      host: cfg.host,
      port: cfg.port,
      database: cfg.database,
      user: cfg.username,
      password: cfg.password,
      ssl: cfg.ssl ? {} : undefined,
      dateStrings: true,
      supportBigNumbers: true,
      bigNumberStrings: false
    });
    const [rows] = await this.conn.query<mysql.RowDataPacket[]>('SELECT VERSION() as v');
    return { serverVersion: String(rows[0]?.v ?? 'mysql') };
  }

  async disconnect(): Promise<void> {
    await this.conn?.end();
    this.conn = null;
  }

  async run(
    query: string,
    opts: { signal?: AbortSignal; database?: string | null } = {}
  ): Promise<QueryResult> {
    if (!this.conn) throw new Error('Not connected');
    const { signal, database } = opts;
    const start = performance.now();
    const onAbort = () => this.conn?.destroy();
    signal?.addEventListener('abort', onAbort, { once: true });
    try {
      if (database) {
        await this.conn.query(`USE \`${database.replace(/`/g, '``')}\``);
      }
      const [rows, fields] = await this.conn.query<mysql.RowDataPacket[]>(query);
      const fieldList = (fields as mysql.FieldPacket[]) ?? [];
      const isResult = Array.isArray(rows) && fieldList.length > 0;
      if (!isResult) {
        const ok = rows as unknown as mysql.ResultSetHeader;
        return {
          columns: [],
          rows: [],
          rowCount: 0,
          affectedRows: ok.affectedRows ?? 0,
          durationMs: Math.round(performance.now() - start),
          query
        };
      }
      const columns: ColumnMeta[] = fieldList.map((f) => {
        const code = typeof f.type === 'number' ? f.type : undefined;
        const raw = f as unknown as {
          schema?: string;
          db?: string;
          orgTable?: string;
          table?: string;
          orgName?: string;
          flags?: number | string[];
        };
        const sourceSchema = raw.schema || raw.db || undefined;
        const sourceTable = raw.orgTable || raw.table || undefined;
        const sourceColumn = raw.orgName || f.name || undefined;
        const isPrimaryKey = hasPriKeyFlag(raw.flags);
        return {
          name: f.name,
          type: mapTypeCode(code),
          dbType: String(f.type ?? ''),
          sourceSchema,
          sourceTable,
          sourceColumn,
          isPrimaryKey
        };
      });
      const editable = deriveEditable(columns);
      if (!editable && columns.length > 0) {
        console.warn(
          '[mysql] no editable metadata derived from result',
          columns.map((c) => ({
            name: c.name,
            sourceTable: c.sourceTable,
            sourceColumn: c.sourceColumn,
            isPrimaryKey: c.isPrimaryKey
          }))
        );
      }
      const normalized = (rows as Record<string, unknown>[]).map((r) => {
        const out: Record<string, unknown> = {};
        for (const c of columns) {
          const v = r[c.name];
          out[c.name] = v instanceof Date ? v.toISOString() : v;
        }
        return out;
      });
      return {
        columns,
        rows: normalized,
        rowCount: normalized.length,
        durationMs: Math.round(performance.now() - start),
        query,
        editable
      };
    } finally {
      signal?.removeEventListener('abort', onAbort);
    }
  }

  async introspect(): Promise<SchemaDatabase[]> {
    if (!this.conn) throw new Error('Not connected');
    const defaultDb = this.cfg?.database ?? '';

    const [schemaRows] = await this.conn.query<mysql.RowDataPacket[]>(
      `SELECT SCHEMA_NAME FROM information_schema.SCHEMATA
        WHERE SCHEMA_NAME NOT IN ('information_schema','mysql','performance_schema','sys')
        ORDER BY SCHEMA_NAME`
    );
    const userSchemas = (schemaRows as Array<{ SCHEMA_NAME: string }>).map((r) => r.SCHEMA_NAME);

    const [tables] = await this.conn.query<mysql.RowDataPacket[]>(
      `SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE FROM information_schema.TABLES
        WHERE TABLE_SCHEMA NOT IN ('information_schema','mysql','performance_schema','sys')
        ORDER BY TABLE_SCHEMA, TABLE_NAME`
    );
    const [cols] = await this.conn.query<mysql.RowDataPacket[]>(
      `SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA NOT IN ('information_schema','mysql','performance_schema','sys')`
    );

    const colMap = new Map<string, ColumnMeta[]>();
    for (const c of cols as Array<Record<string, string>>) {
      const key = `${c.TABLE_SCHEMA}.${c.TABLE_NAME}`;
      const list = colMap.get(key) ?? [];
      list.push({
        name: c.COLUMN_NAME,
        type: mapTypeName(c.DATA_TYPE),
        dbType: c.DATA_TYPE,
        nullable: c.IS_NULLABLE === 'YES'
      });
      colMap.set(key, list);
    }

    const tablesBySchema = new Map<string, SchemaTable[]>();
    for (const s of userSchemas) tablesBySchema.set(s, []);
    for (const t of tables as Array<Record<string, string>>) {
      const list = tablesBySchema.get(t.TABLE_SCHEMA) ?? [];
      list.push({
        name: t.TABLE_NAME,
        schema: t.TABLE_SCHEMA,
        kind: t.TABLE_TYPE === 'VIEW' ? 'view' : 'table',
        columns: colMap.get(`${t.TABLE_SCHEMA}.${t.TABLE_NAME}`) ?? []
      });
      tablesBySchema.set(t.TABLE_SCHEMA, list);
    }

    const ordered = userSchemas
      .slice()
      .sort((a, b) => (a === defaultDb ? -1 : b === defaultDb ? 1 : a.localeCompare(b)));

    return ordered.map((name) => ({ name, tables: tablesBySchema.get(name) ?? [] }));
  }

  async sample(table: SchemaTable, limit = 100): Promise<QueryResult> {
    const schema = table.schema
      ? `\`${table.schema.replace(/`/g, '``')}\`.`
      : '';
    const ident = `${schema}\`${table.name.replace(/`/g, '``')}\``;
    return this.run(`SELECT * FROM ${ident} LIMIT ${limit}`);
  }

  async update(payload: RowUpdate): Promise<UpdateResult> {
    if (!this.conn) throw new Error('Not connected');
    const changeKeys = Object.keys(payload.changes);
    const idKeys = Object.keys(payload.identity);
    if (changeKeys.length === 0) return { affectedRows: 0 };
    if (idKeys.length === 0) {
      throw new Error('Cannot update row: no primary key columns supplied');
    }
    const ident = qualifyMysql(payload.schema, payload.table);
    const setClause = changeKeys.map((k) => `${quoteMysql(k)} = ?`).join(', ');
    const whereClause = idKeys.map((k) => `${quoteMysql(k)} = ?`).join(' AND ');
    const sql = `UPDATE ${ident} SET ${setClause} WHERE ${whereClause}`;
    const params = [
      ...changeKeys.map((k) => normalizeParam(payload.changes[k])),
      ...idKeys.map((k) => normalizeParam(payload.identity[k]))
    ];
    const [res] = await this.conn.query<mysql.ResultSetHeader>(sql, params);
    return { affectedRows: res.affectedRows ?? 0 };
  }
}

function hasPriKeyFlag(flags: number | string[] | undefined): boolean | undefined {
  if (typeof flags === 'number') return (flags & PRI_KEY_FLAG) !== 0;
  if (Array.isArray(flags)) return flags.includes('PRI_KEY') || flags.includes('PRIMARY KEY');
  return undefined;
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

function quoteMysql(ident: string): string {
  return `\`${ident.replace(/`/g, '``')}\``;
}

function qualifyMysql(schema: string | undefined, table: string): string {
  return schema ? `${quoteMysql(schema)}.${quoteMysql(table)}` : quoteMysql(table);
}

function normalizeParam(v: unknown): unknown {
  if (v === undefined) return null;
  if (v !== null && typeof v === 'object') return JSON.stringify(v);
  return v;
}
