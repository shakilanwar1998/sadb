import { useEffect, useMemo, useRef, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
  type ColumnDef
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, Check, MoreVertical, Play } from 'lucide-react';
import type { ColumnType, QueryResult } from '@shared/types';
import { cn } from '@/lib/utils';

const MAX_ROWS = 5000;

// Distinct from the main interface (bg-0 #07080d, bg-1 #0c0e15…): a cooler
// slate-navy palette so the data grid feels like its own surface.
const GRID_BG = '#0e1626';
const GRID_BG_ALT = '#0b1220';
const GRID_HEADER_BG = '#172033';
const GRID_HEADER_BG_HOVER = '#1d2740';
const GRID_HEADER_BG_SORTED = '#1a2a3a';
const GRID_BORDER = 'rgba(148, 163, 184, 0.12)';
const GRID_BORDER_STRONG = 'rgba(148, 163, 184, 0.22)';
const GRID_ROW_HOVER = '#13203a';

export interface CellEdit {
  rowIndex: number;
  column: string;
  value: unknown;
}

interface Props {
  result: QueryResult;
  edits: Record<string, CellEdit>;
  onEdit: (rowIndex: number, column: string, value: unknown) => void;
  selectedRows: Set<number>;
  onToggleRow: (rowIndex: number) => void;
  onToggleAll: () => void;
}

const subformColumns = new Set<string>();

export function ResultsGrid({
  result,
  edits,
  onEdit,
  selectedRows,
  onToggleRow,
  onToggleAll
}: Props) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [openMenuCol, setOpenMenuCol] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(
    null
  );

  const data = useMemo(() => result.rows.slice(0, MAX_ROWS), [result.rows]);

  useEffect(() => {
    const close = (): void => setOpenMenuCol(null);
    if (openMenuCol) {
      window.addEventListener('click', close);
      return () => window.removeEventListener('click', close);
    }
    return undefined;
  }, [openMenuCol]);

  const allSelected = data.length > 0 && data.every((_, i) => selectedRows.has(i));

  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(
    () =>
      result.columns.map((col) => ({
        id: col.name,
        accessorFn: (r) => r[col.name],
        header: () => (
          <ColumnHeader name={col.name} isSubform={subformColumns.has(col.name)} />
        ),
        cell: (info) => {
          const rowIndex = info.row.index;
          const editKey = `${rowIndex}::${col.name}`;
          const edited = edits[editKey];
          const original = info.getValue();
          const value = edited ? edited.value : original;
          const isEditing =
            editingCell?.row === rowIndex && editingCell?.col === col.name;
          return (
            <EditableCell
              value={value}
              original={original}
              type={col.type}
              edited={!!edited}
              isEditing={isEditing}
              onStartEdit={() => setEditingCell({ row: rowIndex, col: col.name })}
              onCommit={(next) => {
                onEdit(rowIndex, col.name, next);
                setEditingCell(null);
              }}
              onCancel={() => setEditingCell(null)}
            />
          );
        }
      })),
    [result.columns, edits, editingCell, onEdit]
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  if (result.columns.length === 0) {
    return (
      <div
        className="flex-1 flex items-center justify-center text-slate-400"
        style={{ background: GRID_BG }}
      >
        <div className="text-center">
          <div className="text-sm">Statement executed.</div>
          {result.affectedRows !== undefined && (
            <div className="text-xs text-slate-500 mt-1">
              {result.affectedRows} row(s) affected
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col" style={{ background: GRID_BG }}>
      <div className="flex-1 overflow-auto">
        <table className="border-separate border-spacing-0 text-sm w-max min-w-full">
          <thead className="sticky top-0 z-10">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                <th
                  className="sticky left-0 z-20 w-12 px-3 py-3"
                  style={{
                    background: GRID_HEADER_BG,
                    borderBottom: `1px solid ${GRID_BORDER_STRONG}`,
                    borderRight: `1px solid ${GRID_BORDER}`
                  }}
                >
                  <button
                    onClick={onToggleAll}
                    className={cn(
                      'w-5 h-5 rounded-full flex items-center justify-center transition',
                      allSelected
                        ? 'bg-emerald-500 text-white'
                        : 'border border-slate-500/60 hover:border-emerald-400'
                    )}
                    title={allSelected ? 'Deselect all' : 'Select all'}
                  >
                    {allSelected && <Check className="w-3 h-3" strokeWidth={3} />}
                  </button>
                </th>
                {hg.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const colName = header.column.id;
                  const isSubform = subformColumns.has(colName);
                  return (
                    <th
                      key={header.id}
                      className="px-3 py-3 text-left select-none whitespace-nowrap relative transition-colors"
                      style={{
                        background: isSubform
                          ? GRID_HEADER_BG_SORTED
                          : sorted
                            ? GRID_HEADER_BG_SORTED
                            : GRID_HEADER_BG,
                        borderBottom: `1px solid ${GRID_BORDER_STRONG}`,
                        borderRight: `1px solid ${GRID_BORDER}`
                      }}
                      onMouseEnter={(e) => {
                        if (!sorted && !isSubform)
                          (e.currentTarget as HTMLElement).style.background =
                            GRID_HEADER_BG_HOVER;
                      }}
                      onMouseLeave={(e) => {
                        if (!sorted && !isSubform)
                          (e.currentTarget as HTMLElement).style.background =
                            GRID_HEADER_BG;
                      }}
                    >
                      <div
                        className="flex items-center gap-1.5 cursor-pointer"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <div className="ml-auto flex items-center gap-0.5">
                          {sorted === 'asc' && (
                            <ArrowUp
                              className="w-3.5 h-3.5 text-emerald-400"
                              strokeWidth={2.4}
                            />
                          )}
                          {sorted === 'desc' && (
                            <ArrowDown
                              className="w-3.5 h-3.5 text-emerald-400"
                              strokeWidth={2.4}
                            />
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuCol((c) => (c === colName ? null : colName));
                            }}
                            className="p-0.5 rounded hover:bg-white/5 text-slate-400 hover:text-slate-200"
                            title="Column options"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      {openMenuCol === colName && (
                        <ColumnMenu
                          onClose={() => setOpenMenuCol(null)}
                          onSortAsc={() => {
                            header.column.toggleSorting(false);
                            setOpenMenuCol(null);
                          }}
                          onSortDesc={() => {
                            header.column.toggleSorting(true);
                            setOpenMenuCol(null);
                          }}
                          onClearSort={() => {
                            header.column.clearSorting();
                            setOpenMenuCol(null);
                          }}
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, i) => {
              const rowIndex = row.index;
              const selected = selectedRows.has(rowIndex);
              const zebra = i % 2 === 0 ? GRID_BG : GRID_BG_ALT;
              return (
                <tr
                  key={row.id}
                  className="group transition-colors"
                  style={{ background: zebra }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLElement).style.background = GRID_ROW_HOVER)
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLElement).style.background = zebra)
                  }
                >
                  <td
                    className="sticky left-0 z-[5] w-12 px-3 py-2 align-middle bg-inherit"
                    style={{
                      borderBottom: `1px solid ${GRID_BORDER}`,
                      borderRight: `1px solid ${GRID_BORDER}`
                    }}
                  >
                    <button
                      onClick={() => onToggleRow(rowIndex)}
                      className={cn(
                        'w-5 h-5 rounded-full flex items-center justify-center transition',
                        selected
                          ? 'bg-emerald-500 text-white'
                          : 'border border-slate-500/60 hover:border-emerald-400'
                      )}
                      title={selected ? 'Deselect row' : 'Select row'}
                    >
                      {selected && <Check className="w-3 h-3" strokeWidth={3} />}
                    </button>
                  </td>
                  {row.getVisibleCells().map((cell) => {
                    const colName = cell.column.id;
                    const isSubform = subformColumns.has(colName);
                    return (
                      <td
                        key={cell.id}
                        className="px-3 py-2 align-middle max-w-[420px] text-slate-200"
                        style={{
                          borderBottom: `1px solid ${GRID_BORDER}`,
                          borderRight: `1px solid ${GRID_BORDER}`,
                          background: isSubform
                            ? 'rgba(16, 185, 129, 0.05)'
                            : undefined
                        }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td
                  colSpan={result.columns.length + 1}
                  className="px-3 py-8 text-center text-sm text-slate-500"
                  style={{ background: GRID_BG }}
                >
                  Query returned no rows
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {result.rowCount > MAX_ROWS && (
        <div
          className="shrink-0 px-3 py-1.5 text-[11px] text-slate-400 text-center"
          style={{
            background: GRID_HEADER_BG,
            borderTop: `1px solid ${GRID_BORDER_STRONG}`
          }}
        >
          Showing first {MAX_ROWS.toLocaleString()} of {result.rowCount.toLocaleString()} rows
        </div>
      )}
    </div>
  );
}

function ColumnHeader({ name, isSubform }: { name: string; isSubform: boolean }) {
  return (
    <div className="flex flex-col min-w-0">
      {isSubform && (
        <span className="text-[9px] uppercase tracking-wider text-emerald-400 font-semibold">
          Subform
        </span>
      )}
      <span className="truncate text-[13px] font-semibold text-slate-100">{name}</span>
    </div>
  );
}

function ColumnMenu({
  onClose,
  onSortAsc,
  onSortDesc,
  onClearSort
}: {
  onClose: () => void;
  onSortAsc: () => void;
  onSortDesc: () => void;
  onClearSort: () => void;
}) {
  return (
    <div
      className="absolute right-2 top-full mt-1 z-30 min-w-[160px] rounded-md shadow-xl py-1 text-sm text-slate-200"
      style={{
        background: GRID_HEADER_BG,
        border: `1px solid ${GRID_BORDER_STRONG}`
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={onSortAsc}
        className="w-full text-left px-3 py-1.5 hover:bg-white/5 flex items-center gap-2"
      >
        <ArrowUp className="w-3.5 h-3.5" /> Sort ascending
      </button>
      <button
        onClick={onSortDesc}
        className="w-full text-left px-3 py-1.5 hover:bg-white/5 flex items-center gap-2"
      >
        <ArrowDown className="w-3.5 h-3.5" /> Sort descending
      </button>
      <button
        onClick={onClearSort}
        className="w-full text-left px-3 py-1.5 hover:bg-white/5 text-slate-400"
      >
        Clear sort
      </button>
      <div className="my-1 border-t border-white/5" />
      <button
        onClick={onClose}
        className="w-full text-left px-3 py-1.5 hover:bg-white/5 text-slate-400"
      >
        Close
      </button>
    </div>
  );
}

function EditableCell({
  value,
  original,
  type,
  edited,
  isEditing,
  onStartEdit,
  onCommit,
  onCancel
}: {
  value: unknown;
  original: unknown;
  type: ColumnType;
  edited: boolean;
  isEditing: boolean;
  onStartEdit: () => void;
  onCommit: (v: unknown) => void;
  onCancel: () => void;
}) {
  const initial =
    value === null || value === undefined
      ? ''
      : typeof value === 'object'
        ? JSON.stringify(value)
        : String(value);
  const [draft, setDraft] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      setDraft(initial);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
        className="w-full h-7 px-2 -mx-1 rounded border border-emerald-400/70 ring-2 ring-emerald-500/30 outline-none bg-[#0a1424] text-[13px] text-slate-100"
      />
    );

    function commit(): void {
      const trimmed = draft;
      let next: unknown = trimmed;
      if (trimmed === '') {
        next = null;
      } else if (type === 'number') {
        const n = Number(trimmed);
        next = Number.isFinite(n) ? n : trimmed;
      } else if (type === 'boolean') {
        next = /^(true|1|yes|y)$/i.test(trimmed);
      } else if (type === 'json') {
        try {
          next = JSON.parse(trimmed);
        } catch {
          next = trimmed;
        }
      }
      const originalStr =
        original === null || original === undefined
          ? ''
          : typeof original === 'object'
            ? JSON.stringify(original)
            : String(original);
      if (originalStr === trimmed) {
        onCancel();
      } else {
        onCommit(next);
      }
    }
  }

  const display = renderDisplay(value, type);

  return (
    <div
      onDoubleClick={onStartEdit}
      className={cn(
        'cursor-text select-text rounded px-1 -mx-1 min-h-[24px] text-[13px]',
        edited && 'bg-amber-400/10 ring-1 ring-amber-400/40'
      )}
      title="Double-click to edit"
    >
      {display}
    </div>
  );
}

function renderDisplay(value: unknown, type: ColumnType): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-slate-500 italic">NULL</span>;
  }
  if (type === 'boolean') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2 h-5 rounded-md text-[11px] font-medium border',
          value
            ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300'
            : 'border-slate-600 bg-slate-700/40 text-slate-300'
        )}
      >
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            value ? 'bg-emerald-400' : 'bg-slate-400'
          )}
        />
        {String(value)}
      </span>
    );
  }
  if (type === 'number') {
    return (
      <span className="font-mono text-[12.5px] text-amber-300 tabular-nums">
        {String(value)}
      </span>
    );
  }
  if (type === 'date') {
    return (
      <span className="font-mono text-[12.5px] text-emerald-300">{String(value)}</span>
    );
  }
  if (type === 'json' || typeof value === 'object') {
    const text = JSON.stringify(value);
    const truncated = text.length > 200 ? text.slice(0, 200) + '…' : text;
    if (typeof value === 'object' && value !== null && Array.isArray(value)) {
      return (
        <span className="inline-flex items-center gap-2 text-slate-200">
          <span>{value.length} records</span>
          <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
        </span>
      );
    }
    return (
      <pre
        className="text-[11.5px] text-sky-300 font-mono whitespace-pre-wrap break-words max-h-24 overflow-auto"
        title={text}
      >
        {truncated}
      </pre>
    );
  }
  const s = String(value);
  return (
    <span
      className="text-slate-200 whitespace-pre-wrap break-words line-clamp-3"
      title={s}
    >
      {s}
    </span>
  );
}
