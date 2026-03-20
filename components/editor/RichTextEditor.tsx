"use client";

import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style/text-style";
import { Color } from "@tiptap/extension-text-style/color";
import { FontFamily } from "@tiptap/extension-text-style/font-family";
import { FontSize } from "@tiptap/extension-text-style/font-size";
import { useEffect, useMemo, type CSSProperties, type MouseEvent } from "react";
import { useTheme } from "@/components/ThemeProvider";
import type { ChainedCommands, Editor } from "@tiptap/core";

/** Native controls steal focus and drop the caret; ProseMirror then won’t apply stored marks until you type again. */
function preventToolbarTakeFocus(e: MouseEvent) {
  e.preventDefault();
}

/**
 * Run after the browser finishes the select/picker interaction. If the view isn’t focused (first interaction),
 * place the caret at the end so empty documents still accept stored marks.
 */
function runTextStyleChain(editor: Editor, fn: (chain: ChainedCommands) => ChainedCommands) {
  queueMicrotask(() => {
    if (editor.isDestroyed) return;
    const start = editor.view.hasFocus() ? editor.chain().focus() : editor.chain().focus("end");
    fn(start).run();
  });
}

/** Normalize for matching TipTap’s font-family string to our preset stacks. */
function normFont(s: string) {
  return s
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/\s*,\s*/g, ",")
    .replace(/\s+/g, " ")
    .trim();
}

const FONT_PRESETS = [
  { label: "Default", value: "" },
  { label: "System UI", value: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
  { label: "Serif (Georgia)", value: "Georgia, 'Times New Roman', Times, ui-serif, serif" },
  { label: "Times", value: "'Times New Roman', Times, Georgia, serif" },
  { label: "Palatino", value: "'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif" },
  { label: "Garamond", value: "Garamond, 'Palatino Linotype', serif" },
  { label: "Verdana", value: "Verdana, Geneva, Tahoma, sans-serif" },
  { label: "Trebuchet", value: "'Trebuchet MS', 'Lucida Sans Unicode', 'Lucida Grande', sans-serif" },
  { label: "Arial / Helvetica", value: "Arial, Helvetica, 'Helvetica Neue', sans-serif" },
  { label: "Segoe / Roboto", value: "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" },
  { label: "Monospace", value: "ui-monospace, 'SF Mono', 'Cascadia Code', 'Courier New', Courier, monospace" },
  { label: "Courier", value: "'Courier New', Courier, ui-monospace, monospace" },
  { label: "Impact", value: "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif" },
  { label: "Comic Sans", value: "'Comic Sans MS', 'Comic Sans', cursive, sans-serif" },
] as const;

const SIZE_PX = ["10", "11", "12", "13", "14", "15", "16", "18", "20", "22", "24", "28", "32", "36"] as const;

const COLOR_PRESETS = [
  "#1c1917",
  "#57534e",
  "#78716c",
  "#b91c1c",
  "#c2410c",
  "#ca8a04",
  "#15803d",
  "#0d9488",
  "#1d4ed8",
  "#7c3aed",
  "#db2777",
  "#ffffff",
  "#000000",
] as const;

function matchPresetFont(current: string | undefined | null): string {
  if (!current) return "";
  const n = normFont(current);
  for (const f of FONT_PRESETS) {
    if (!f.value) continue;
    if (normFont(f.value) === n) return f.value;
  }
  return "";
}

function hexForColorInput(attrs: { color?: string | null }): string {
  const c = attrs.color;
  if (c && /^#[0-9a-f]{6}$/i.test(c)) return c;
  if (c && /^#[0-9a-f]{3}$/i.test(c)) {
    const r = c[1];
    const g = c[2];
    const b = c[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return "#1c1917";
}

type ToolbarUiState = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  h2: boolean;
  h3: boolean;
  bulletList: boolean;
  orderedList: boolean;
  blockquote: boolean;
  alignLeft: boolean;
  alignCenter: boolean;
  alignRight: boolean;
  link: boolean;
  textStyle: Record<string, unknown>;
  canUndo: boolean;
  canRedo: boolean;
};

const emptyToolbar: ToolbarUiState = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  h2: false,
  h3: false,
  bulletList: false,
  orderedList: false,
  blockquote: false,
  alignLeft: false,
  alignCenter: false,
  alignRight: false,
  link: false,
  textStyle: {},
  canUndo: false,
  canRedo: false,
};

function readToolbarUi(ed: Editor): ToolbarUiState {
  return {
    bold: ed.isActive("bold"),
    italic: ed.isActive("italic"),
    underline: ed.isActive("underline"),
    strike: ed.isActive("strike"),
    h2: ed.isActive("heading", { level: 2 }),
    h3: ed.isActive("heading", { level: 3 }),
    bulletList: ed.isActive("bulletList"),
    orderedList: ed.isActive("orderedList"),
    blockquote: ed.isActive("blockquote"),
    alignLeft: ed.isActive({ textAlign: "left" }),
    alignCenter: ed.isActive({ textAlign: "center" }),
    alignRight: ed.isActive({ textAlign: "right" }),
    link: ed.isActive("link"),
    textStyle: ed.getAttributes("textStyle"),
    canUndo: ed.can().undo(),
    canRedo: ed.can().redo(),
  };
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Write something…",
  minHeight = 160,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}) {
  const { settings } = useTheme();
  const accent = settings.accentColour;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
        // StarterKit v3 ships link + underline; we register our own below with custom options.
        link: false,
        underline: false,
      }),
      Underline,
      TextStyle,
      Color.configure({ types: ["textStyle"] }),
      FontFamily.configure({ types: ["textStyle"] }),
      FontSize.configure({ types: ["textStyle"] }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({ openOnClick: false, autolink: true, defaultProtocol: "https" }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || "<p></p>",
    editorProps: {
      attributes: {
        // Let TipTap prepend `tiptap` / ProseMirror classes; duplicate ProseMirror can confuse the view.
        class: "rich-editor-prose",
        style: `min-height:${minHeight}px;outline:none;padding:12px 14px;font-size:15px;line-height:1.6;color:var(--text);`,
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
    immediatelyRender: false,
  });

  const toolbar =
    useEditorState({
      editor,
      selector: ({ editor: ed }) => (ed ? readToolbarUi(ed) : emptyToolbar),
    }) ?? emptyToolbar;

  useEffect(() => {
    if (!editor || value === editor.getHTML()) return;
    editor.commands.setContent(value || "<p></p>", { emitUpdate: false });
  }, [editor, value]);

  const textStyleAttrs = toolbar.textStyle;

  const fontSelectValue = useMemo(
    () => matchPresetFont(textStyleAttrs.fontFamily as string | undefined),
    [textStyleAttrs.fontFamily],
  );

  const sizeSelectValue = useMemo(() => {
    const fs = textStyleAttrs.fontSize as string | undefined;
    if (!fs) return "";
    const m = fs.match(/^(\d+(?:\.\d+)?)px$/i);
    if (!m) return "";
    const n = m[1];
    return SIZE_PX.includes(n as (typeof SIZE_PX)[number]) ? n : n;
  }, [textStyleAttrs.fontSize]);

  const sizeOptions = useMemo(() => {
    const base = [...SIZE_PX];
    const cur = sizeSelectValue;
    if (cur && !base.includes(cur as (typeof SIZE_PX)[number])) {
      base.push(cur as (typeof SIZE_PX)[number]);
      base.sort((a, b) => Number(a) - Number(b));
    }
    return base;
  }, [sizeSelectValue]);

  if (!editor) {
    return (
      <div
        style={{
          minHeight,
          borderRadius: 10,
          border: "1px solid var(--border)",
          background: "var(--bg)",
          color: "var(--muted)",
          padding: 14,
          fontSize: 14,
        }}
      >
        Loading editor…
      </div>
    );
  }

  const selectStyle: CSSProperties = {
    fontSize: 14,
    fontWeight: 500,
    padding: "6px 10px",
    minHeight: 36,
    borderRadius: 8,
    border: "1px solid var(--border)",
    backgroundColor: "var(--surface)",
    color: "var(--text)",
    maxWidth: 200,
    minWidth: 120,
    cursor: "pointer",
    WebkitAppearance: "menulist",
    appearance: "auto",
  };

  const colorPickerVal = hexForColorInput(textStyleAttrs);

  return (
    <div
      style={{
        borderRadius: 10,
        border: "1px solid var(--border)",
        background: "var(--bg)",
        overflow: "visible",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: "8px 10px",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
          overflow: "visible",
          position: "relative",
          borderTopLeftRadius: 10,
          borderTopRightRadius: 10,
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          <ToolbarBtn label="Undo" accent={accent} disabled={!toolbar.canUndo} onClick={() => editor.chain().focus().undo().run()} />
          <ToolbarBtn label="Redo" accent={accent} disabled={!toolbar.canRedo} onClick={() => editor.chain().focus().redo().run()} />
          <span style={{ width: 1, height: 20, background: "var(--border)", margin: "0 4px" }} />
          <ToolbarBtn label="B" accent={accent} active={toolbar.bold} onClick={() => editor.chain().focus().toggleBold().run()} />
          <ToolbarBtn label="I" accent={accent} active={toolbar.italic} onClick={() => editor.chain().focus().toggleItalic().run()} />
          <ToolbarBtn label="U" accent={accent} active={toolbar.underline} onClick={() => editor.chain().focus().toggleUnderline().run()} />
          <ToolbarBtn label="S" accent={accent} active={toolbar.strike} onClick={() => editor.chain().focus().toggleStrike().run()} />
          <span style={{ width: 1, height: 20, background: "var(--border)", margin: "0 4px" }} />
          <ToolbarBtn label="H2" accent={accent} active={toolbar.h2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
          <ToolbarBtn label="H3" accent={accent} active={toolbar.h3} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
          <ToolbarBtn label="• List" accent={accent} active={toolbar.bulletList} onClick={() => editor.chain().focus().toggleBulletList().run()} />
          <ToolbarBtn label="1. List" accent={accent} active={toolbar.orderedList} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
          <ToolbarBtn label="❝" accent={accent} active={toolbar.blockquote} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
          <span style={{ width: 1, height: 20, background: "var(--border)", margin: "0 4px" }} />
          <ToolbarBtn label="←" accent={accent} active={toolbar.alignLeft} onClick={() => editor.chain().focus().setTextAlign("left").run()} />
          <ToolbarBtn label="↔" accent={accent} active={toolbar.alignCenter} onClick={() => editor.chain().focus().setTextAlign("center").run()} />
          <ToolbarBtn label="→" accent={accent} active={toolbar.alignRight} onClick={() => editor.chain().focus().setTextAlign("right").run()} />
          <ToolbarBtn
            label="Link"
            accent={accent}
            active={toolbar.link}
            onClick={() => {
              const prev = editor.getAttributes("link").href as string | undefined;
              const url = window.prompt("URL", prev ?? "https://");
              if (url === null) return;
              if (url === "") {
                editor.chain().focus().extendMarkRange("link").unsetLink().run();
                return;
              }
              editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
            }}
          />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Font</label>
          <select
            aria-label="Font family"
            style={selectStyle}
            value={fontSelectValue}
            onChange={(e) => {
              const v = e.target.value;
              runTextStyleChain(editor, (ch) => (v ? ch.setFontFamily(v) : ch.unsetFontFamily()));
            }}
          >
            {FONT_PRESETS.map((f) => (
              <option key={f.label} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Size</label>
          <select
            aria-label="Font size"
            style={{ ...selectStyle, maxWidth: 88, minWidth: 80 }}
            value={sizeSelectValue}
            onChange={(e) => {
              const v = e.target.value;
              runTextStyleChain(editor, (ch) => (v ? ch.setFontSize(`${v}px`) : ch.unsetFontSize()));
            }}
          >
            <option value="">Auto</option>
            {sizeOptions.map((n) => (
              <option key={n} value={n}>
                {n}px
              </option>
            ))}
          </select>
          <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Colour</span>
          <input
            type="color"
            aria-label="Text colour"
            value={colorPickerVal}
            onMouseDown={preventToolbarTakeFocus}
            onChange={(e) => runTextStyleChain(editor, (ch) => ch.setColor(e.target.value))}
            style={{
              width: 40,
              height: 32,
              padding: 2,
              borderRadius: 8,
              border: `1px solid var(--border)`,
              background: "var(--surface)",
              cursor: "pointer",
            }}
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
            <button
              type="button"
              title="Default text colour"
              onClick={() => runTextStyleChain(editor, (ch) => ch.unsetColor())}
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                border: "2px solid var(--border)",
                background: "linear-gradient(135deg, #fff 45%, #000 45%, #000 55%, #fff 55%)",
                cursor: "pointer",
              }}
            />
            {COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                onClick={() => runTextStyleChain(editor, (ch) => ch.setColor(c))}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  border:
                    (textStyleAttrs.color as string | undefined)?.toLowerCase() === c.toLowerCase()
                      ? `2px solid ${accent}`
                      : "1px solid var(--border)",
                  background: c,
                  cursor: "pointer",
                  boxShadow: c === "#ffffff" ? "inset 0 0 0 1px rgba(0,0,0,0.12)" : undefined,
                }}
              />
            ))}
          </div>
        </div>
      </div>
      <div
        style={{
          overflowX: "auto",
          overflowY: "visible",
          borderBottomLeftRadius: 10,
          borderBottomRightRadius: 10,
          minHeight,
          cursor: "text",
        }}
        onMouseDown={(e) => {
          if (e.button !== 0) return;
          if (editor.isDestroyed) return;
          const dom = editor.view.dom;
          const t = e.target as Node | null;
          if (!t || !dom.contains(t)) return;
          window.requestAnimationFrame(() => {
            if (editor.isDestroyed) return;
            if (!editor.view.hasFocus()) editor.view.focus();
          });
        }}
      >
        <EditorContent editor={editor} />
      </div>
      <style>{`
        /* Beat Tailwind preflight (list-style: none; padding: 0) */
        .rich-editor-prose ul {
          margin: 0.5em 0 !important;
          padding-left: 1.75rem !important;
          list-style-position: outside !important;
          list-style-type: disc !important;
        }
        .rich-editor-prose ol {
          margin: 0.5em 0 !important;
          padding-left: 1.75rem !important;
          list-style-position: outside !important;
          list-style-type: decimal !important;
        }
        .rich-editor-prose ul ul { list-style-type: circle !important; }
        .rich-editor-prose ul ul ul { list-style-type: square !important; }
        .rich-editor-prose li {
          display: list-item !important;
          margin: 0.2em 0 !important;
        }
        .rich-editor-prose li p { margin: 0.15em 0 !important; }
        .rich-editor-prose p { margin: 0.45em 0; }
        .rich-editor-prose p.is-editor-empty:first-child { position: relative; min-height: 1.6em; }
        .rich-editor-prose p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          position: absolute;
          left: 0;
          top: 0;
          color: var(--muted);
          pointer-events: none;
        }
        .rich-editor-prose blockquote { margin: 0.6em 0; padding-left: 1rem; border-left: 3px solid var(--border); color: var(--muted); }
        .rich-editor-prose h2 { font-size: 1.35rem; font-weight: 700; margin: 0.6em 0 0.35em; line-height: 1.25; }
        .rich-editor-prose h3 { font-size: 1.15rem; font-weight: 700; margin: 0.55em 0 0.3em; line-height: 1.3; }
        .rich-editor-prose a { color: ${accent}; text-decoration: underline; }
      `}</style>
    </div>
  );
}

function ToolbarBtn({
  label,
  active = false,
  disabled = false,
  onClick,
  accent,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  accent: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: "4px 10px",
        borderRadius: 6,
        border: `1px solid ${active ? accent : "var(--border)"}`,
        background: active ? `${accent}22` : "var(--bg)",
        color: active ? accent : "var(--muted)",
        fontSize: 12,
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        minWidth: 28,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {label}
    </button>
  );
}
