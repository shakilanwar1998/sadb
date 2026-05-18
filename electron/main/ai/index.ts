import type {
  AiProvider,
  AiQueryResponse,
  DbKind,
  SchemaDatabase
} from '@shared/types';
import { askAnthropic } from './anthropic';
import { askOpenAi } from './openai';
import { askGemini } from './gemini';

export interface AskParams {
  provider: AiProvider;
  apiKey: string;
  model: string;
  prompt: string;
  dbKind: DbKind;
  schema: SchemaDatabase[];
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export function systemPrompt(dbKind: DbKind, schema: SchemaDatabase[]): string {
  const dialect: Record<DbKind, string> = {
    postgres: 'PostgreSQL',
    mysql: 'MySQL',
    mongodb: 'MongoDB (use the db.collection.method() shell syntax)'
  };
  const schemaText = schema
    .map((db) => {
      const tables = db.tables
        .slice(0, 80)
        .map((t) => {
          const cols = (t.columns ?? [])
            .map((c) => `${c.name}:${c.dbType ?? c.type}`)
            .join(', ');
          return `  - ${t.schema ? `${t.schema}.` : ''}${t.name} (${cols})`;
        })
        .join('\n');
      return `Database: ${db.name}\n${tables}`;
    })
    .join('\n\n');
  return `You are SaDB Agent, an expert ${dialect[dbKind]} engineer. The user describes data they want; you respond with a runnable query.

STRICT OUTPUT FORMAT — respond with a single JSON object only, no prose, no code fences:
{
  "reasoning": "1-2 sentences on your approach",
  "sql": "the executable query string",
  "notes": "optional warnings or caveats"
}

Rules:
- Use ${dialect[dbKind]} syntax exclusively.
- Prefer LIMIT/limit() clauses for SELECT/find queries (default 100) unless the user requests otherwise.
- Never invent tables or columns; only use what's in the schema.
- Use safe quoting for identifiers.
- For MongoDB, use the db.collection.find()/aggregate() shell form (no Compass quirks).

Schema available:
${schemaText || '(no introspected schema available; do your best)'}
`;
}

export async function generateQuery(params: AskParams): Promise<AiQueryResponse> {
  const sys = systemPrompt(params.dbKind, params.schema);
  const raw = await callProvider({ ...params, system: sys });
  return parseResponse(raw);
}

async function callProvider(p: AskParams & { system: string }): Promise<string> {
  switch (p.provider) {
    case 'anthropic':
      return askAnthropic(p);
    case 'openai':
      return askOpenAi(p);
    case 'gemini':
      return askGemini(p);
  }
}

function parseResponse(raw: string): AiQueryResponse {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as AiQueryResponse;
    if (typeof parsed.sql !== 'string') throw new Error('missing sql');
    return parsed;
  } catch {
    const sqlBlock = raw.match(/```(?:sql|mongodb|mongo|js)?\s*([\s\S]*?)```/i);
    if (sqlBlock) {
      return { sql: sqlBlock[1].trim(), reasoning: stripCode(raw).slice(0, 280) };
    }
    return { sql: raw.trim(), reasoning: '' };
  }
}

function stripCode(s: string): string {
  return s.replace(/```[\s\S]*?```/g, '').trim();
}
