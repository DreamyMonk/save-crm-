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
  const lastHtmlRef = useRef(value);

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
      quill.clipboard.dangerouslyPasteHTML(value || "");
      lastHtmlRef.current = value || "";
      quill.on("text-change", () => {
        const html = quill.getSemanticHTML();
        lastHtmlRef.current = html;
        onChange(html);
      });
    }

    void createEditor();

    return () => {
      mounted = false;
    };
  }, [onChange, placeholder, value]);

  useEffect(() => {
    const quill = quillRef.current;
    if (!quill || value === lastHtmlRef.current) return;
    const selection = quill.getSelection();
    quill.clipboard.dangerouslyPasteHTML(value || "");
    lastHtmlRef.current = value || "";
    if (selection) {
      quill.setSelection(selection);
    }
  }, [value]);

  return (
    <div ref={containerRef} className="overflow-hidden rounded-lg border border-[#d7dfd0] bg-white">
      <div ref={editorRef} style={{ minHeight }} />
    </div>
  );
}
