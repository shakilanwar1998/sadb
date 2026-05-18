import { useEffect, useMemo, useRef } from 'react';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { sql, MySQL, PostgreSQL, StandardSQL } from '@codemirror/lang-sql';
import { javascript } from '@codemirror/lang-javascript';
import { EditorView, keymap } from '@codemirror/view';
import { Prec } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { format } from 'sql-formatter';
import type { DbKind, SchemaDatabase } from '@shared/types';

const EDITOR_BG = '#07080d';

const sadbTheme = EditorView.theme(
  {
    '&': {
      color: '#e6e9f2',
      backgroundColor: EDITOR_BG,
      height: '100%',
      fontSize: '14px'
    },
    '.cm-scroller': {
      fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
      lineHeight: '1.6',
      overflow: 'auto'
    },
    '.cm-content': {
      padding: '14px 0',
      caretColor: '#7c5cff',
      backgroundColor: EDITOR_BG
    },
    '.cm-gutters': {
      backgroundColor: EDITOR_BG,
      color: '#3a4055',
      border: 'none',
      borderRight: '1px solid rgba(255,255,255,0.04)',
      paddingRight: '10px'
    },
    '.cm-gutterElement': {
      paddingLeft: '12px'
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(124,92,255,0.07)'
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'transparent',
      color: '#9097ac'
    },
    '.cm-cursor': {
      borderLeftColor: '#7c5cff',
      borderLeftWidth: '2px'
    },
    '.cm-selectionBackground, &.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-content ::selection':
      {
        background: 'rgba(124, 92, 255, 0.55) !important'
      },
    '&.cm-focused .cm-selectionBackground': {
      background: 'rgba(124, 92, 255, 0.55) !important'
    },
    '.cm-line ::selection, .cm-line::selection': {
      background: 'rgba(124, 92, 255, 0.55) !important',
      color: '#ffffff !important'
    },
    '.cm-selectionMatch': {
      backgroundColor: 'rgba(34,211,238,0.16)'
    },
    '.cm-matchingBracket, .cm-nonmatchingBracket': {
      backgroundColor: 'rgba(124,92,255,0.18)',
      outline: '1px solid rgba(124,92,255,0.4)'
    },
    '.cm-tooltip': {
      background: '#11141d',
      border: '1px solid rgba(255,255,255,0.10)',
      borderRadius: '8px',
      color: '#e6e9f2',
      fontFamily: 'Inter, sans-serif',
      fontSize: '12px',
      boxShadow: '0 12px 40px -12px rgba(0,0,0,0.55)'
    },
    '.cm-tooltip.cm-tooltip-autocomplete': {
      padding: '4px'
    },
    '.cm-tooltip.cm-tooltip-autocomplete > ul': {
      maxHeight: '280px',
      fontFamily: '"JetBrains Mono", ui-monospace, monospace'
    },
    '.cm-tooltip.cm-tooltip-autocomplete > ul > li': {
      padding: '4px 8px',
      borderRadius: '4px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    '.cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]': {
      background: 'rgba(124,92,255,0.22)',
      color: '#e6e9f2'
    },
    '.cm-completionLabel': { color: '#e6e9f2' },
    '.cm-completionDetail': {
      color: '#9097ac',
      fontStyle: 'normal',
      marginLeft: 'auto',
      fontSize: '11px'
    },
    '.cm-completionIcon': {
      width: '14px',
      opacity: 0.7,
      paddingRight: '4px'
    },
    '.cm-completionIcon-table::after': { content: '"⊟"', color: '#22d3ee' },
    '.cm-completionIcon-column::after': { content: '"·"', color: '#ffb547' },
    '.cm-completionIcon-keyword::after': { content: '"K"', color: '#a994ff' },
    '.cm-completionIcon-type::after': { content: '"T"', color: '#34e3b1' },
    '.cm-panels': {
      background: '#11141d',
      color: '#e6e9f2',
      borderTop: '1px solid rgba(255,255,255,0.08)'
    },
    '.cm-searchMatch': {
      backgroundColor: 'rgba(255,181,71,0.25)',
      outline: '1px solid rgba(255,181,71,0.6)'
    }
  },
  { dark: true }
);

const sadbHighlight = HighlightStyle.define([
  { tag: t.keyword, color: '#a994ff', fontWeight: '600' },
  { tag: [t.string, t.special(t.string)], color: '#34e3b1' },
  { tag: t.number, color: '#ffb547' },
  { tag: t.bool, color: '#ff5d8f' },
  { tag: t.null, color: '#ff5d8f' },
  { tag: t.comment, color: '#5b6178', fontStyle: 'italic' },
  { tag: t.operator, color: '#22d3ee' },
  { tag: t.punctuation, color: '#9097ac' },
  { tag: [t.variableName, t.propertyName], color: '#e6e9f2' },
  { tag: t.function(t.variableName), color: '#22d3ee' },
  { tag: t.typeName, color: '#22d3ee' },
  { tag: t.bracket, color: '#5b6178' }
]);

interface Props {
  tabId: string;
  value: string;
  onChange: (v: string) => void;
  onRun: () => void;
  dbKind?: DbKind;
  schema?: SchemaDatabase[];
  activeDb?: string | null;
}

function buildSqlSchema(
  databases: SchemaDatabase[] | undefined,
  activeDb: string | null | undefined
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!databases?.length) return out;
  const onlyOne = databases.length === 1;
  for (const db of databases) {
    const isActive = db.name === activeDb || onlyOne;
    for (const table of db.tables) {
      const cols = (table.columns ?? []).map((c) => c.name);
      if (isActive) out[table.name] = cols;
      out[`${db.name}.${table.name}`] = cols;
    }
  }
  return out;
}

export function QueryEditor({
  tabId,
  value,
  onChange,
  onRun,
  dbKind,
  schema,
  activeDb
}: Props) {
  const editorRef = useRef<ReactCodeMirrorRef>(null);

  const formatCurrent = (): void => {
    const view = editorRef.current?.view;
    if (!view) return;
    const text = view.state.doc.toString();
    try {
      const language = dbKind === 'mysql' ? 'mysql' : dbKind === 'postgres' ? 'postgresql' : 'sql';
      if (dbKind === 'mongodb') return;
      const formatted = format(text, { language, tabWidth: 2, keywordCase: 'upper' });
      view.dispatch({ changes: { from: 0, to: text.length, insert: formatted } });
    } catch {
      /* swallow formatter errors */
    }
  };

  const sqlSchema = useMemo(() => buildSqlSchema(schema, activeDb), [schema, activeDb]);
  const tableNames = useMemo(() => Object.keys(sqlSchema), [sqlSchema]);

  const extensions = useMemo(() => {
    const dialect =
      dbKind === 'mysql' ? MySQL : dbKind === 'postgres' ? PostgreSQL : StandardSQL;

    const langExt =
      dbKind === 'mongodb'
        ? javascript()
        : sql({
            dialect,
            upperCaseKeywords: true,
            schema: sqlSchema,
            defaultSchema: activeDb ?? undefined,
            defaultTable: tableNames[0]
          });

    const shortcuts = Prec.highest(
      keymap.of([
        {
          key: 'Mod-Enter',
          preventDefault: true,
          run: () => {
            onRun();
            return true;
          }
        },
        {
          key: 'Shift-Alt-f',
          preventDefault: true,
          run: () => {
            formatCurrent();
            return true;
          }
        }
      ])
    );

    return [
      syntaxHighlighting(sadbHighlight),
      EditorView.lineWrapping,
      langExt,
      shortcuts
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbKind, onRun, sqlSchema, activeDb, tableNames]);

  useEffect(() => {
    const handler = (ev: Event) => {
      const e = ev as CustomEvent<string>;
      if (e.detail !== tabId) return;
      formatCurrent();
    };
    window.addEventListener('sadb:format-query', handler);
    return () => window.removeEventListener('sadb:format-query', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId, dbKind]);

  return (
    <div
      className="flex-1 min-h-0 relative overflow-hidden"
      style={{ backgroundColor: EDITOR_BG }}
    >
      <CodeMirror
        ref={editorRef}
        value={value}
        height="100%"
        theme={sadbTheme}
        extensions={extensions}
        onChange={(v) => onChange(v)}
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          autocompletion: true,
          bracketMatching: true,
          closeBrackets: true,
          highlightSelectionMatches: true,
          indentOnInput: true,
          tabSize: 2
        }}
        style={{ height: '100%', fontSize: '14px', backgroundColor: EDITOR_BG }}
      />
    </div>
  );
}
