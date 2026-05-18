import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronRight,
  Table2,
  Eye,
  Boxes,
  Search,
  Database,
  AlertCircle,
  Check
} from 'lucide-react';
import type { SchemaDatabase, SchemaTable, ColumnType } from '@shared/types';
import { cn } from '@/lib/utils';

interface Props {
  schema: SchemaDatabase[];
  activeDb: string | null;
  onSelectDb: (dbName: string) => void;
  onOpenTable: (db: string, table: SchemaTable) => void;
}

const typeColor: Record<ColumnType, string> = {
  string: 'text-accent-cyan',
  number: 'text-accent-amber',
  boolean: 'text-accent-rose',
  date: 'text-accent-mint',
  json: 'text-brand-400',
  unknown: 'text-ink-faint'
};

export function SchemaTree({
  schema,
  activeDb,
  onSelectDb,
  onOpenTable
}: Props) {
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  function toggle(name: string): void {
    setExpanded((e) => ({ ...e, [name]: !e[name] }));
  }

  const filtered = useMemo(() => {
    if (!q.trim()) return schema;
    const needle = q.toLowerCase();
    return schema
      .map((db) => ({
        ...db,
        tables: db.tables.filter(
          (t) =>
            t.name.toLowerCase().includes(needle) ||
            t.columns?.some((c) => c.name.toLowerCase().includes(needle))
        )
      }))
      .filter((db) => db.tables.length > 0 || db.name.toLowerCase().includes(needle));
  }, [schema, q]);

  if (schema.length === 0) {
    return (
      <div className="py-1 px-1">
        <div className="rounded-md border border-line bg-bg-2/60 p-3 text-[11px] text-ink-dim flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
          <div>
            <div className="text-ink font-medium mb-0.5">No databases visible</div>
            <div className="text-ink-faint">
              Connection succeeded but no databases were returned. Check the user's privileges or
              that the server hosts any user databases.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-1">
      <div className="px-1 pb-1 relative">
        <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter tables…"
          className="w-full h-7 pl-6 pr-2 text-[12px] bg-bg-2 border border-line rounded-md placeholder:text-ink-faint focus:outline-none focus:border-brand"
        />
      </div>
      {filtered.map((db) => {
        const isExpanded = q.trim()
          ? true
          : expanded[db.name] ?? false;
        const isActive = activeDb === db.name;
        return (
          <DbSection
            key={db.name}
            db={db}
            expanded={isExpanded}
            active={isActive}
            onToggle={() => toggle(db.name)}
            onSelect={() => onSelectDb(db.name)}
            onOpenTable={(t) => onOpenTable(db.name, t)}
          />
        );
      })}
      {filtered.length === 0 && (
        <div className="px-2 py-3 text-[11px] text-ink-faint text-center">No matches</div>
      )}
    </div>
  );
}

function DbSection({
  db,
  expanded,
  active,
  onToggle,
  onSelect,
  onOpenTable
}: {
  db: SchemaDatabase;
  expanded: boolean;
  active: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onOpenTable: (t: SchemaTable) => void;
}) {
  return (
    <div className="mb-0.5">
      <div
        className={cn(
          'group flex items-center gap-1 px-1 py-1 rounded-md cursor-pointer transition-colors',
          active ? 'bg-brand/15 border border-brand/30' : 'hover:bg-bg-2 border border-transparent'
        )}
        onClick={onSelect}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="p-0.5 rounded hover:bg-bg-3"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          <ChevronRight
            className={cn(
              'w-3 h-3 text-ink-faint transition-transform shrink-0',
              expanded && 'rotate-90'
            )}
          />
        </button>
        <Database className={cn('w-3.5 h-3.5 shrink-0', active ? 'text-brand-400' : 'text-ink-dim')} />
        <span
          className={cn(
            'text-[12px] font-medium truncate flex-1',
            active ? 'text-ink' : 'text-ink-dim'
          )}
        >
          {db.name}
        </span>
        {active && <Check className="w-3 h-3 text-brand-400 shrink-0" />}
        <span className="text-[10px] font-mono text-ink-faint">{db.tables.length}</span>
      </div>
      {expanded && (
        <div className="ml-3 pl-2 border-l border-line">
          {db.tables.map((t) => (
            <TableRow
              key={`${t.schema ?? ''}.${t.name}`}
              table={t}
              onOpen={() => onOpenTable(t)}
            />
          ))}
          {db.tables.length === 0 && (
            <div className="px-2 py-1 text-[11px] text-ink-faint italic">
              empty — no tables yet
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TableRow({
  table,
  onOpen
}: {
  table: SchemaTable;
  onOpen: () => void;
}) {
  const [openCols, setOpenCols] = useState(false);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const Icon = table.kind === 'view' ? Eye : table.kind === 'collection' ? Boxes : Table2;

  useEffect(
    () => () => {
      if (clickTimer.current) clearTimeout(clickTimer.current);
    },
    []
  );

  function toggleCols(): void {
    setOpenCols((o) => !o);
  }

  function handleRowClick(): void {
    if (clickTimer.current !== null) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      onOpen();
      return;
    }
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      toggleCols();
    }, 220);
  }

  return (
    <div>
      <div
        className="group flex items-center gap-1 px-1 py-1 rounded-md hover:bg-bg-2 cursor-pointer select-none"
        onClick={handleRowClick}
        title="Click: expand columns · Double-click: query 100 rows"
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (clickTimer.current) {
              clearTimeout(clickTimer.current);
              clickTimer.current = null;
            }
            toggleCols();
          }}
          className="p-0.5 rounded hover:bg-bg-3"
          aria-label={openCols ? 'Collapse columns' : 'Expand columns'}
        >
          <ChevronRight
            className={cn(
              'w-3 h-3 text-ink-faint transition-transform shrink-0',
              openCols && 'rotate-90'
            )}
          />
        </button>
        <Icon className="w-3.5 h-3.5 text-ink-dim shrink-0" />
        <span className="text-[12px] flex-1 truncate">{table.name}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (clickTimer.current) {
              clearTimeout(clickTimer.current);
              clickTimer.current = null;
            }
            onOpen();
          }}
          className="opacity-0 group-hover:opacity-100 text-[10px] text-brand-400 hover:text-brand-400/80 px-1.5 py-0.5 rounded border border-brand/30 bg-brand/10"
          title="Run SELECT * … LIMIT 100"
        >
          run
        </button>
      </div>
      {openCols && (
        <div className="ml-5 pl-2 border-l border-line py-0.5">
          {(table.columns ?? []).slice(0, 80).map((c) => (
            <div
              key={c.name}
              className="flex items-center gap-1.5 px-1 py-0.5 text-[11px] hover:bg-bg-2 rounded"
            >
              <span className="truncate text-ink">{c.name}</span>
              <span
                className={cn(
                  'ml-auto font-mono text-[10px]',
                  typeColor[c.type]
                )}
              >
                {c.dbType ?? c.type}
              </span>
            </div>
          ))}
          {(table.columns ?? []).length === 0 && (
            <div className="px-1 py-0.5 text-[11px] text-ink-faint">No column info</div>
          )}
        </div>
      )}
    </div>
  );
}
