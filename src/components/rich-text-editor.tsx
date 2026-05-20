"use client";

import "quill/dist/quill.snow.css";
import { useEffect, useRef } from "react";
import type Quill from "quill";

type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
};

const toolbar = [
  [{ header: [1, 2, 3, false] }],
  ["bold", "italic", "underline"],
  [{ list: "ordered" }, { list: "bullet" }],
  ["link", "blockquote"],
  ["clean"],
];

export function RichTextEditor({ value, onChange, placeholder, minHeight = 220 }: RichTextEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const quillRef = useRef<Quill | null>(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value || "");
  const lastHtmlRef = useRef(value || "");
  const applyingValueRef = useRef(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    valueRef.current = value || "";
  }, [value]);

  useEffect(() => {
    let mounted = true;

    async function createEditor() {
      if (!editorRef.current || quillRef.current) return;
      const QuillModule = await import("quill");
      if (!mounted || !editorRef.current) return;
      const quill = new QuillModule.default(editorRef.current, {
        theme: "snow",
        placeholder,
        modules: { toolbar },
      });
      quillRef.current = quill;
      applyingValueRef.current = true;
      quill.clipboard.dangerouslyPasteHTML(valueRef.current);
      applyingValueRef.current = false;
      lastHtmlRef.current = valueRef.current;
      quill.on("text-change", () => {
        if (applyingValueRef.current) return;
        const html = quill.root.innerHTML;
        lastHtmlRef.current = html;
        onChangeRef.current(html);
      });
    }

    void createEditor();

    return () => {
      mounted = false;
    };
  }, [placeholder]);

  useEffect(() => {
    const quill = quillRef.current;
    if (!quill || value === lastHtmlRef.current) return;
    const selection = quill.getSelection();
    applyingValueRef.current = true;
    quill.clipboard.dangerouslyPasteHTML(value || "");
    applyingValueRef.current = false;
    lastHtmlRef.current = value || "";
    if (selection) {
      quill.setSelection(selection);
    }
  }, [value]);

  return (
    <div ref={containerRef} className="overflow-hidden rounded-lg border border-[#d7dfd0] bg-white">
      <div ref={editorRef} style={{ minHeight }} />
      <style jsx global>{`
        .ql-container.ql-snow,
        .ql-toolbar.ql-snow {
          background: #ffffff;
          color: #0f172a;
        }

        .ql-editor,
        .ql-editor p,
        .ql-editor li,
        .ql-editor span,
        .ql-editor strong,
        .ql-editor em,
        .ql-editor u {
          color: #0f172a !important;
        }

        .ql-editor.ql-blank::before {
          color: #657267;
          opacity: 1;
        }
      `}</style>
    </div>
  );
}
