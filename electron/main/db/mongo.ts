import { MongoClient, type Db, ObjectId } from 'mongodb';
import type { Driver } from './driver';
import type {
  ColumnMeta,
  ColumnType,
  ConnectionConfig,
  QueryResult,
  SchemaDatabase,
  SchemaTable
} from '@shared/types';

export class MongoDriver implements Driver {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private cfg: ConnectionConfig | null = null;

  async connect(cfg: ConnectionConfig): Promise<{ serverVersion: string }> {
    this.cfg = cfg;
    const uri = cfg.uri || buildUri(cfg);
    this.client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });
    await this.client.connect();
    this.db = this.client.db(cfg.database || undefined);
    const info = await this.db.admin().serverInfo();
    return { serverVersion: `MongoDB ${info.version}` };
  }

  async disconnect(): Promise<void> {
    await this.client?.close();
    this.client = null;
    this.db = null;
  }

  async run(
    query: string,
    opts: { signal?: AbortSignal; database?: string | null } = {}
  ): Promise<QueryResult> {
    if (!this.client) throw new Error('Not connected');
    if (opts.database) {
      this.db = this.client.db(opts.database);
    }
    if (!this.db) throw new Error('No database selected');
    const start = performance.now();
    const result = await runMongoQuery(this.db, query);
    const rows = Array.isArray(result) ? result : [result];
    const flat = rows.map(flattenDoc);
    const columns = inferColumns(flat);
    return {
      columns,
      rows: flat,
      rowCount: flat.length,
      durationMs: Math.round(performance.now() - start),
      query
    };
  }

  async introspect(): Promise<SchemaDatabase[]> {
    if (!this.client) throw new Error('Not connected');
    const currentDbName = this.db?.databaseName ?? this.cfg?.database ?? '';

    let dbNames: string[] = [];
    try {
      const admin = this.client.db('admin').admin();
      const list = await admin.listDatabases();
      dbNames = list.databases
        .map((d) => d.name)
        .filter((n) => !['admin', 'local', 'config'].includes(n));
    } catch {
      if (currentDbName) dbNames = [currentDbName];
    }

    if (currentDbName && !dbNames.includes(currentDbName)) {
      dbNames.unshift(currentDbName);
    } else if (currentDbName) {
      dbNames = [currentDbName, ...dbNames.filter((n) => n !== currentDbName)];
    }

    const result: SchemaDatabase[] = [];
    for (const name of dbNames) {
      const db = this.client.db(name);
      try {
        const collections = await db.listCollections().toArray();
        const tables: SchemaTable[] = await Promise.all(
          collections.map(async (c) => {
            const sample = await db.collection(c.name).findOne().catch(() => null);
            const columns = sample ? inferColumnsFromDoc(flattenDoc(sample)) : [];
            return { name: c.name, schema: name, kind: 'collection' as const, columns };
          })
        );
        result.push({ name, tables });
      } catch {
        result.push({ name, tables: [] });
      }
    }
    return result;
  }

  async sample(table: SchemaTable, limit = 100): Promise<QueryResult> {
    if (table.schema && this.client) {
      this.db = this.client.db(table.schema);
    }
    return this.run(`db.${table.name}.find({}).limit(${limit})`);
  }
}

function buildUri(cfg: ConnectionConfig): string {
  const auth = cfg.username
    ? `${encodeURIComponent(cfg.username)}:${encodeURIComponent(cfg.password ?? '')}@`
    : '';
  const db = cfg.database ? `/${cfg.database}` : '';
  return `mongodb://${auth}${cfg.host}:${cfg.port}${db}`;
}

async function runMongoQuery(db: Db, query: string): Promise<unknown> {
  const trimmed = query.trim().replace(/;$/, '');
  const m = trimmed.match(/^db\.([\w$.-]+)\.(\w+)\((.*)\)(?:\.(\w+)\(([^)]*)\))?$/s);
  if (!m) {
    throw new Error(
      'Unsupported Mongo expression. Use forms like:\n  db.coll.find({})\n  db.coll.find({}).limit(50)\n  db.coll.aggregate([{$match:{...}}])\n  db.coll.countDocuments({})'
    );
  }
  const [, coll, op, argStr, chainOp, chainArg] = m;
  const args = parseArgs(argStr);
  const collection = db.collection(coll);

  let value: unknown;
  switch (op) {
    case 'find': {
      const cursor = collection.find(args[0] ?? {}, args[1] ?? {});
      if (chainOp === 'limit') cursor.limit(Number(chainArg) || 100);
      else if (chainOp === 'sort') cursor.sort(parseArgs(chainArg ?? '{}')[0] ?? {});
      else cursor.limit(100);
      value = await cursor.toArray();
      break;
    }
    case 'findOne':
      value = await collection.findOne(args[0] ?? {}, args[1] ?? {});
      break;
    case 'aggregate':
      value = await collection.aggregate(args[0] ?? []).toArray();
      break;
    case 'countDocuments':
      value = { count: await collection.countDocuments(args[0] ?? {}) };
      break;
    case 'insertOne':
      value = await collection.insertOne(args[0]);
      break;
    case 'insertMany':
      value = await collection.insertMany(args[0]);
      break;
    case 'updateOne':
      value = await collection.updateOne(args[0], args[1]);
      break;
    case 'updateMany':
      value = await collection.updateMany(args[0], args[1]);
      break;
    case 'deleteOne':
      value = await collection.deleteOne(args[0]);
      break;
    case 'deleteMany':
      value = await collection.deleteMany(args[0]);
      break;
    default:
      throw new Error(`Unsupported operation: ${op}`);
  }
  return value;
}

function parseArgs(src: string): unknown[] {
  if (!src.trim()) return [];
  const wrapped = `[${src}]`;
  try {
    return new Function('ObjectId', 'ISODate', `return ${wrapped}`)(
      (v: string) => new ObjectId(v),
      (v?: string) => (v ? new Date(v) : new Date())
    );
  } catch (err) {
    throw new Error(`Invalid Mongo arguments: ${(err as Error).message}`);
  }
}

function flattenDoc(doc: unknown, prefix = ''): Record<string, unknown> {
  if (!doc || typeof doc !== 'object') return { value: doc };
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(doc as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v instanceof ObjectId) out[key] = v.toString();
    else if (v instanceof Date) out[key] = v.toISOString();
    else if (v && typeof v === 'object' && !Array.isArray(v)) {
      const nested = flattenDoc(v, key);
      Object.assign(out, nested);
    } else {
      out[key] = v;
    }
  }
  return out;
}

function inferColumns(rows: Array<Record<string, unknown>>): ColumnMeta[] {
  const seen = new Map<string, ColumnType>();
  for (const r of rows.slice(0, 50)) {
    for (const [k, v] of Object.entries(r)) {
      if (seen.has(k)) continue;
      seen.set(k, inferType(v));
    }
  }
  return Array.from(seen, ([name, type]) => ({ name, type }));
}

function inferColumnsFromDoc(doc: Record<string, unknown>): ColumnMeta[] {
  return Object.entries(doc).map(([name, value]) => ({ name, type: inferType(value) }));
}

function inferType(v: unknown): ColumnType {
  if (v === null || v === undefined) return 'unknown';
  if (typeof v === 'number') return 'number';
  if (typeof v === 'boolean') return 'boolean';
  if (typeof v === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return 'date';
    return 'string';
  }
  if (typeof v === 'object') return 'json';
  return 'unknown';
}
