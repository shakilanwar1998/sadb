import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Braces,
  ChevronDown,
  Download,
  Eye,
  Link2,
  Plus,
  Send,
  Table2,
  Upload,
  Wrench
} from 'lucide-react';
import type { QueryResult } from '@shared/types';
import { useApp, type ResultView, type Tab } from '@/lib/store';
import { cn, downloadFile, formatMs, toCsv } from '@/lib/utils';
import { ResultsGrid, type CellEdit } from './ResultsGrid';
import { ResultsJson } from './ResultsJson';
import { ResultsChart } from './ResultsChart';

interface Props {
  tab: Tab;
}

const viewOptions: {
  id: ResultView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'table', label: 'Table', icon: Table2 },
  { id: 'json', label: 'JSON', icon: Braces },
  { id: 'chart', label: 'Chart', icon: BarChart3 }
];

export function ResultsView({ tab }: Props) {
  const updateTab = useApp((s) => s.updateTab);
  const showToast = useApp((s) => s.showToast);
  const result = tab.result;
  const error = tab.error;

  const [edits, setEdits] = useState<Record<string, CellEdit>>({});
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  useEffect(() => {
    setEdits({});
    setSelectedRows(new Set());
  }, [result]);

  const editCount = Object.keys(edits).length;
  const editsByRow = useMemo(() => {
    const map = new Map<number, CellEdit[]>();
    for (const e of Object.values(edits)) {
      const list = map.get(e.rowIndex) ?? [];
      list.push(e);
      map.set(e.rowIndex, list);
    }
    return map;
  }, [edits]);

  function onEdit(rowIndex: number, column: string, value: unknown): void {
    setEdits((prev) => ({
      ...prev,
      [`${rowIndex}::${column}`]: { rowIndex, column, value }
    }));
  }

  function onToggleRow(rowIndex: number): void {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) next.delete(rowIndex);
      else next.add(rowIndex);
      return next;
    });
  }

  function onToggleAll(): void {
    if (!result) return;
    const all = result.rows.length;
    setSelectedRows((prev) => {
      if (prev.size === all) return new Set();
      return new Set(result.rows.map((_, i) => i));
    });
  }

  async function saveChanges(): Promise<void> {
    if (editCount === 0 || !result) return;
    if (!tab.connectionId) {
      showToast('error', 'Open a connection before saving changes');
      return;
    }
    if (!result.editable) {
      showToast('error', explainNoEditable(result));
      return;
    }
    const { schema, table, primaryKey } = result.editable;
    const columnByName = new Map(result.columns.map((c) => [c.name, c]));
    try {
      let touched = 0;
      const nextRows = result.rows.slice();
      for (const [rowIndex, rowEdits] of editsByRow.entries()) {
        const original = result.rows[rowIndex];
        const identity: Record<string, unknown> = {};
        for (const pk of primaryKey) {
          const col = result.columns.find((c) => c.sourceColumn === pk);
          const idVal = col ? original[col.name] : undefined;
          if (idVal === undefined || idVal === null) {
            throw new Error(`Missing primary key "${pk}" for row ${rowIndex + 1}`);
          }
          identity[pk] = idVal;
        }
        const changes: Record<string, unknown> = {};
        for (const e of rowEdits) {
          const col = columnByName.get(e.column);
          const dbColumn = col?.sourceColumn ?? e.column;
          changes[dbColumn] = e.value;
        }
        await window.sadb.query.update(tab.connectionId, {
          schema,
          table,
          identity,
          changes
        });
        const merged = { ...original };
        for (const e of rowEdits) merged[e.column] = e.value;
        nextRows[rowIndex] = merged;
        touched += 1;
      }
      updateTab(tab.id, { result: { ...result, rows: nextRows } });
      setEdits({});
      showToast('success', `Saved ${touched} row(s) to ${table}`);
    } catch (e) {
      showToast('error', `Save failed: ${(e as Error).message}`);
    }
  }

  function discardChanges(): void {
    setEdits({});
  }

  function exportCsv(): void {
    if (!result) return;
    const cols = result.columns.map((c) => c.name);
    const rows = applyEdits(result.rows, edits);
    const csv = toCsv(rows, cols);
    downloadFile(`sadb-${Date.now()}.csv`, csv, 'text/csv');
  }

  function exportJson(): void {
    if (!result) return;
    const rows = applyEdits(result.rows, edits);
    downloadFile(
      `sadb-${Date.now()}.json`,
      JSON.stringify(rows, null, 2),
      'application/json'
    );
  }

  return (
    <div
      className="flex-1 min-h-0 flex flex-col"
      style={{ background: '#0e1626' }}
    >
      <Toolbar
        tab={tab}
        result={result}
        editCount={editCount}
        selectedCount={selectedRows.size}
        onSave={saveChanges}
        onDiscard={discardChanges}
        onExportCsv={exportCsv}
        onExportJson={exportJson}
        onSetView={(v) => updateTab(tab.id, { view: v })}
      />

      {error ? (
        <div className="flex-1 p-6 overflow-auto" style={{ background: '#0e1626' }}>
          <div className="border border-rose-500/30 bg-rose-500/5 rounded-lg p-4">
            <div className="text-rose-300 font-mono text-[12.5px] whitespace-pre-wrap">
              {error}
            </div>
          </div>
        </div>
      ) : result ? (
        <ResultsBody
          view={tab.view}
          result={result}
          edits={edits}
          onEdit={onEdit}
          selectedRows={selectedRows}
          onToggleRow={onToggleRow}
          onToggleAll={onToggleAll}
        />
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

function ResultsBody({
  view,
  result,
  edits,
  onEdit,
  selectedRows,
  onToggleRow,
  onToggleAll
}: {
  view: ResultView;
  result: QueryResult;
  edits: Record<string, CellEdit>;
  onEdit: (rowIndex: number, column: string, value: unknown) => void;
  selectedRows: Set<number>;
  onToggleRow: (rowIndex: number) => void;
  onToggleAll: () => void;
}) {
  switch (view) {
    case 'table':
      return (
        <ResultsGrid
          result={result}
          edits={edits}
          onEdit={onEdit}
          selectedRows={selectedRows}
          onToggleRow={onToggleRow}
          onToggleAll={onToggleAll}
        />
      );
    case 'json':
      return <ResultsJson result={result} />;
    case 'chart':
      return <ResultsChart result={result} />;
  }
}

function EmptyState() {
  return (
    <div
      className="flex-1 flex items-center justify-center text-center px-6"
      style={{ background: '#0e1626' }}
    >
      <div>
        <div className="text-sm text-slate-300">Press ⌘⏎ to run your query</div>
        <div className="text-xs text-slate-500 mt-1">
          Or use the AI assistant to translate plain English into a query.
        </div>
      </div>
    </div>
  );
}

interface ToolbarProps {
  tab: Tab;
  result: QueryResult | null;
  editCount: number;
  selectedCount: number;
  onSave: () => void;
  onDiscard: () => void;
  onExportCsv: () => void;
  onExportJson: () => void;
  onSetView: (v: ResultView) => void;
}

function Toolbar({
  tab,
  result,
  editCount,
  selectedCount,
  onSave,
  onDiscard,
  onExportCsv,
  onExportJson,
  onSetView
}: ToolbarProps) {
  const showToast = useApp((s) => s.showToast);
  const notImpl = (label: string): void =>
    showToast('info', `${label}: coming soon`);

  return (
    <div
      className="shrink-0 flex items-center gap-1.5 px-3 py-2"
      style={{
        background: '#172033',
        borderBottom: '1px solid rgba(148, 163, 184, 0.22)'
      }}
    >
      <ToolbarButton
        primary
        icon={<Plus className="w-3.5 h-3.5" strokeWidth={2.5} />}
        label="Add"
        onClick={() => notImpl('Add row')}
      />
      <ToolbarButton
        icon={<Send className="w-3.5 h-3.5" />}
        label="Submit"
        onClick={onSave}
        disabled={editCount === 0}
        badge={editCount > 0 ? editCount : undefined}
        title={
          editCount > 0
            ? `Save ${editCount} pending change(s)`
            : 'No pending changes to submit'
        }
      />
      <ToolbarDropdown
        icon={<Eye className="w-3.5 h-3.5" />}
        label="Views"
        items={viewOptions.map((v) => ({
          label: v.label,
          icon: <v.icon className="w-3.5 h-3.5" />,
          active: tab.view === v.id,
          onClick: () => onSetView(v.id)
        }))}
      />
      <ToolbarDropdown
        icon={<Upload className="w-3.5 h-3.5" />}
        label="Import"
        items={[
          { label: 'Import CSV', onClick: () => notImpl('Import CSV') },
          { label: 'Import JSON', onClick: () => notImpl('Import JSON') }
        ]}
      />
      <ToolbarDropdown
        icon={<Download className="w-3.5 h-3.5" />}
        label="Export"
        items={[
          { label: 'Export CSV', onClick: onExportCsv, disabled: !result },
          { label: 'Export JSON', onClick: onExportJson, disabled: !result }
        ]}
      />
      <ToolbarDropdown
        icon={<Link2 className="w-3.5 h-3.5" />}
        label="Collection link"
        items={[
          { label: 'Copy share link', onClick: () => notImpl('Share link') },
          { label: 'Manage permissions', onClick: () => notImpl('Permissions') }
        ]}
      />
      <ToolbarDropdown
        icon={<BarChart3 className="w-3.5 h-3.5" />}
        label="Analyze"
        items={[
          {
            label: 'Open chart view',
            onClick: () => onSetView('chart'),
            disabled: !result
          },
          { label: 'Summary stats', onClick: () => notImpl('Summary stats') }
        ]}
      />
      <ToolbarDropdown
        icon={<Wrench className="w-3.5 h-3.5" />}
        label="Tools"
        items={[
          {
            label: 'Discard pending edits',
            onClick: onDiscard,
            disabled: editCount === 0
          },
          { label: 'Clear selection', onClick: () => notImpl('Clear selection') }
        ]}
      />

      <div className="ml-auto flex items-center gap-3 text-[11px] text-slate-400">
        {selectedCount > 0 && (
          <span className="text-slate-300">{selectedCount} selected</span>
        )}
        {editCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            {editCount} unsaved
          </span>
        )}
        {result && (
          <span>
            {result.rowCount.toLocaleString()} rows · {formatMs(result.durationMs)}
          </span>
        )}
      </div>
    </div>
  );
}

function ToolbarButton({
  icon,
  label,
  onClick,
  primary,
  disabled,
  badge,
  title
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
  badge?: number;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'h-8 px-2.5 rounded-md text-[12.5px] font-medium inline-flex items-center gap-1.5 border transition-colors',
        disabled && 'opacity-50 cursor-not-allowed',
        primary
          ? 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-400/40 text-emerald-200'
          : 'bg-[#1d2740] hover:bg-[#243054] border-white/5 text-slate-200'
      )}
    >
      {icon}
      <span>{label}</span>
      {badge !== undefined && (
        <span className="ml-1 px-1.5 h-4 inline-flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold">
          {badge}
        </span>
      )}
    </button>
  );
}

interface DropdownItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}

function ToolbarDropdown({
  icon,
  label,
  items
}: {
  icon: React.ReactNode;
  label: string;
  items: DropdownItem[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const handle = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('click', handle);
    return () => window.removeEventListener('click', handle);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="h-8 px-2.5 rounded-md text-[12.5px] font-medium inline-flex items-center gap-1.5 border bg-[#1d2740] hover:bg-[#243054] border-white/5 text-slate-200"
      >
        {icon}
        <span>{label}</span>
        <ChevronDown className="w-3 h-3 text-slate-400" />
      </button>
      {open && (
        <div
          className="absolute left-0 top-full mt-1 z-30 min-w-[180px] rounded-md shadow-xl py-1"
          style={{
            background: '#172033',
            border: '1px solid rgba(148, 163, 184, 0.22)'
          }}
        >
          {items.map((it, i) => (
            <button
              key={i}
              onClick={() => {
                if (it.disabled) return;
                setOpen(false);
                it.onClick();
              }}
              disabled={it.disabled}
              className={cn(
                'w-full text-left px-3 py-1.5 text-sm flex items-center gap-2',
                it.disabled
                  ? 'text-slate-500 cursor-not-allowed'
                  : 'text-slate-200 hover:bg-white/5',
                it.active && 'bg-emerald-500/15 text-emerald-300'
              )}
            >
              {it.icon}
              <span>{it.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function explainNoEditable(result: QueryResult): string {
  const tables = new Set(
    result.columns.map((c) => c.sourceTable).filter((t): t is string => !!t)
  );
  if (tables.size === 0) {
    return 'Cannot save: this result has no table metadata. Re-run the query after restarting the app.';
  }
  if (tables.size > 1) {
    return `Cannot save: result spans multiple tables (${Array.from(tables).join(
      ', '
    )}). Inline edits only work for single-table queries.`;
  }
  const [table] = tables;
  const hasPk = result.columns.some((c) => c.isPrimaryKey);
  if (!hasPk) {
    return `Cannot save: ${table} has no primary key columns in this result. Include the primary key in your SELECT.`;
  }
  return `Cannot save: editable metadata missing for ${table}. Re-run the query.`;
}

function applyEdits(
  rows: Array<Record<string, unknown>>,
  edits: Record<string, CellEdit>
): Array<Record<string, unknown>> {
  if (Object.keys(edits).length === 0) return rows;
  return rows.map((row, i) => {
    let next: Record<string, unknown> | null = null;
    for (const e of Object.values(edits)) {
      if (e.rowIndex !== i) continue;
      next = next ?? { ...row };
      next[e.column] = e.value;
    }
    return next ?? row;
  });
}
