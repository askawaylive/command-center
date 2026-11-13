"use client";
import { useEditor, EditorContent, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import { Placeholder } from "@tiptap/extensions";
import { Icon } from "./Icon";

/** Older notes were plain text; turn them into paragraphs so the editor keeps line breaks. */
export function toHtml(text: string) {
  if (!text) return "";
  if (/^\s*</.test(text)) return text;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text
    .split("\n")
    .map((l) => `<p>${esc(l)}</p>`)
    .join("");
}

function Toolbar({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      heading: e.isActive("heading", { level: 2 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      task: e.isActive("taskList"),
      quote: e.isActive("blockquote"),
      link: e.isActive("link"),
    }),
  });
  const btn = (active: boolean) =>
    `inline-flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-[13px] transition-colors ${
      active ? "bg-accent-soft text-accent" : "text-muted hover:bg-sidebar hover:text-ink"
    }`;
  const chain = () => editor.chain().focus();
  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link address", prev ?? "https://");
    if (url === null) return;
    if (!url.trim() || url.trim() === "https://") return chain().extendMarkRange("link").unsetLink().run();
    const href = /^[a-z]+:/i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
    chain().extendMarkRange("link").setLink({ href }).run();
  };
  const sep = <span className="mx-0.5 h-4 w-px bg-line" />;

  return (
    <div className="flex flex-wrap items-center gap-0.5" onMouseDown={(e) => e.preventDefault()}>
      <button className={btn(s.bold)} onClick={() => chain().toggleBold().run()} title="Bold (⌘B)" aria-label="Bold"><b>B</b></button>
      <button className={btn(s.italic)} onClick={() => chain().toggleItalic().run()} title="Italic (⌘I)" aria-label="Italic"><i className="font-serif">I</i></button>
      <button className={btn(s.underline)} onClick={() => chain().toggleUnderline().run()} title="Underline (⌘U)" aria-label="Underline"><u>U</u></button>
      <button className={btn(s.strike)} onClick={() => chain().toggleStrike().run()} title="Strikethrough" aria-label="Strikethrough"><s>S</s></button>
      {sep}
      <button className={btn(s.heading)} onClick={() => chain().toggleHeading({ level: 2 }).run()} title="Heading" aria-label="Heading">H</button>
      <button className={btn(s.bullet)} onClick={() => chain().toggleBulletList().run()} title="Bulleted list" aria-label="Bulleted list"><Icon name="list" size={15} /></button>
      <button className={btn(s.ordered)} onClick={() => chain().toggleOrderedList().run()} title="Numbered list" aria-label="Numbered list"><Icon name="listOrdered" size={15} /></button>
      <button className={btn(s.task)} onClick={() => chain().toggleTaskList().run()} title="Checklist" aria-label="Checklist"><Icon name="checklist" size={15} /></button>
      <button className={btn(s.quote)} onClick={() => chain().toggleBlockquote().run()} title="Quote" aria-label="Quote"><Icon name="quote" size={15} /></button>
      <button className={btn(s.link)} onClick={setLink} title="Link" aria-label="Link"><Icon name="link" size={15} /></button>
    </div>
  );
}

/** Rich text note editor: bold, italic, headings, lists, checklists, links. Emits HTML. */
export function RichNote({
  initial,
  onChange,
  placeholder,
  editable = true,
  toolbarSlot,
}: {
  initial: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  editable?: boolean;
  /** Rendered at the left of the toolbar row (e.g. a section title). */
  toolbarSlot?: React.ReactNode;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: !editable, autolink: true, linkOnPaste: true, HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" } },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
    ],
    content: toHtml(initial),
    onUpdate: ({ editor: e }) => onChange?.(e.isEmpty ? "" : e.getHTML()),
    editorProps: {
      attributes: { class: "rich-note h-full outline-none" },
      // ⌘/Ctrl-click opens a link while editing.
      handleClick: (_view, _pos, event) => {
        const a = (event.target as HTMLElement).closest("a");
        if (a?.href && (event.metaKey || event.ctrlKey)) {
          window.open(a.href, "_blank", "noopener,noreferrer");
          return true;
        }
        return false;
      },
    },
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      {(editable || toolbarSlot) && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {toolbarSlot}
          {editable && editor && <Toolbar editor={editor} />}
        </div>
      )}
      <div
        className="min-h-0 flex-1 cursor-text overflow-y-auto scroll-thin"
        onClick={(e) => {
          if (editable && e.target === e.currentTarget) editor?.chain().focus("end").run();
        }}
      >
        <EditorContent editor={editor} className="h-full" />
      </div>
    </div>
  );
}
