"use client";

import type React from "react";
import { useMemo, useState } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import {
  ArrowDownToLine,
  Circle,
  FileText,
  GripVertical,
  Image as ImageIcon,
  Mail,
  PanelTop,
  Plus,
  Save,
  Signature,
  Square,
  Table2,
  Trash2,
  Type,
} from "lucide-react";
import { CrmShell, PageHeader, ButtonLink } from "@/components/crm-shell";
import {
  Lead,
  Product,
  ProposalDocument,
  ProposalElement,
  ProposalElementType,
  ProposalPageData,
  currency,
  slugify,
} from "@/lib/crm-data";
import { useCrmStore } from "@/lib/use-crm-store";

const pageWidth = 595;
const pageHeight = 842;
const pagePadding = 42;

type EditAction = {
  mode: "move" | "resize";
  pageId: string;
  elementId: string;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  originWidth: number;
  originHeight: number;
};

const tools: { type: ProposalElementType; label: string; icon: React.ReactNode }[] = [
  { type: "heading", label: "Heading", icon: <PanelTop size={16} /> },
  { type: "paragraph", label: "Paragraph", icon: <Type size={16} /> },
  { type: "client", label: "Client details", icon: <FileText size={16} /> },
  { type: "amount", label: "Amount box", icon: <Plus size={16} /> },
  { type: "table", label: "Price table", icon: <Table2 size={16} /> },
  { type: "signature", label: "Signature", icon: <Signature size={16} /> },
  { type: "image", label: "Image block", icon: <ImageIcon size={16} /> },
  { type: "rect", label: "Rectangle", icon: <Square size={16} /> },
  { type: "circle", label: "Circle", icon: <Circle size={16} /> },
  { type: "line", label: "Line", icon: <GripVertical size={16} /> },
];

export default function ProposalPage() {
  const { id } = useParams<{ id: string }>();
  const { state, setState } = useCrmStore();
  const lead = state.leads.find((item) => item.id === id);
  const initialPages = useMemo(() => (lead ? buildProposalPages(lead) : []), [lead]);
  const [pages, setPages] = useState<ProposalPageData[]>(initialPages);
  const [selected, setSelected] = useState({ pageId: initialPages[0]?.id ?? "", elementId: initialPages[0]?.elements[0]?.id ?? "" });
  const [action, setAction] = useState<EditAction | null>(null);
  const [status, setStatus] = useState("Document editor ready");
  const selectedElement = pages.flatMap((page) => page.elements.map((element) => ({ ...element, pageId: page.id }))).find((element) => element.id === selected.elementId && element.pageId === selected.pageId);

  function updateElement(pageId: string, elementId: string, updates: Partial<ProposalElement>) {
    setPages((current) =>
      current.map((page) =>
        page.id === pageId
          ? {
              ...page,
              elements: page.elements.map((element) => (element.id === elementId ? { ...element, ...updates } : element)),
            }
          : page,
      ),
    );
  }

  function addBlock(type: ProposalElementType) {
    if (!lead) return;
    const pageId = selected.pageId || pages[0]?.id || "page-1";
    const pageIndex = Math.max(0, pages.findIndex((page) => page.id === pageId));
    const count = pages.reduce((total, page) => total + page.elements.length, 0) + 1;
    const element = createElement(type, lead, count);
    setPages((current) =>
      current.map((page, index) =>
        index === pageIndex
          ? {
              ...page,
              elements: [...page.elements, element],
            }
          : page,
      ),
    );
    setSelected({ pageId: pages[pageIndex]?.id ?? pageId, elementId: element.id });
    setStatus(`${blockLabel(type)} added`);
  }

  function addPage() {
    const page = { id: `page-${pages.length + 1}`, elements: [] };
    setPages((current) => [...current, page]);
    setSelected({ pageId: page.id, elementId: "" });
    setStatus("New PDF page added");
  }

  function importProduct(product: Product) {
    const pageId = selected.pageId || pages[0]?.id || "page-1";
    const pageIndex = Math.max(0, pages.findIndex((page) => page.id === pageId));
    const count = pages.reduce((total, page) => total + page.elements.length, 0) + 1;
    const element = createProductElement(product, count);
    setPages((current) =>
      current.map((page, index) =>
        index === pageIndex
          ? {
              ...page,
              elements: [...page.elements, element],
            }
          : page,
      ),
    );
    setSelected({ pageId: pages[pageIndex]?.id ?? pageId, elementId: element.id });
    setStatus(`${product.productName} imported into proposal`);
  }

  function deleteSelected() {
    if (!selected.elementId) return;
    setPages((current) =>
      current.map((page) =>
        page.id === selected.pageId
          ? {
              ...page,
              elements: page.elements.filter((element) => element.id !== selected.elementId),
            }
          : page,
      ),
    );
    setSelected({ pageId: selected.pageId, elementId: "" });
    setStatus("Block removed");
  }

  function startMove(pageId: string, element: ProposalElement, event: React.PointerEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    setSelected({ pageId, elementId: element.id });
    setAction({
      mode: "move",
      pageId,
      elementId: element.id,
      startX: event.clientX,
      startY: event.clientY,
      originX: element.x,
      originY: element.y,
      originWidth: element.width,
      originHeight: element.height,
    });
  }

  function startResize(pageId: string, element: ProposalElement, event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setSelected({ pageId, elementId: element.id });
    setAction({
      mode: "resize",
      pageId,
      elementId: element.id,
      startX: event.clientX,
      startY: event.clientY,
      originX: element.x,
      originY: element.y,
      originWidth: element.width,
      originHeight: element.height,
    });
  }

  function moveAction(event: React.PointerEvent<HTMLDivElement>) {
    if (!action) return;
    const deltaX = event.clientX - action.startX;
    const deltaY = event.clientY - action.startY;
    if (action.mode === "move") {
      updateElement(action.pageId, action.elementId, {
        x: clamp(action.originX + deltaX, 0, pageWidth - 24),
        y: clamp(action.originY + deltaY, 0, pageHeight - 24),
      });
      return;
    }
    updateElement(action.pageId, action.elementId, {
      width: clamp(action.originWidth + deltaX, 24, pageWidth - action.originX),
      height: clamp(action.originHeight + deltaY, 16, pageHeight - action.originY),
    });
  }

  function handleKeyboard(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!selectedElement) return;
    const tag = event.target instanceof HTMLElement ? event.target.tagName : "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    const step = event.shiftKey ? 10 : 2;
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      deleteSelected();
      return;
    }
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const sizeEdit = event.altKey;
    const xStep = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
    const yStep = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
    if (sizeEdit) {
      updateElement(selected.pageId, selected.elementId, {
        width: clamp(selectedElement.width + xStep, 24, pageWidth - selectedElement.x),
        height: clamp(selectedElement.height + yStep, 16, pageHeight - selectedElement.y),
      });
      return;
    }
    updateElement(selected.pageId, selected.elementId, {
      x: clamp(selectedElement.x + xStep, 0, pageWidth - selectedElement.width),
      y: clamp(selectedElement.y + yStep, 0, pageHeight - selectedElement.height),
    });
  }

  function saveProposal(nextStatus = "Proposal saved") {
    if (!lead) return;
    const proposal: ProposalDocument = { pages, elements: pages[0]?.elements ?? [], updatedAt: "Now" };
    setState({
      ...state,
      leads: state.leads.map((item) => (item.id === lead.id ? { ...item, proposal } : item)),
    });
    setStatus(nextStatus);
  }

  async function createPdf() {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    renderPdfPages(pdf, pages);
    return pdf;
  }

  async function downloadProposal() {
    if (!lead) return;
    const pdf = await createPdf();
    pdf.save(`${slugify(lead.company)}-${lead.id}-proposal.pdf`);
    saveProposal("PDF downloaded and proposal saved");
  }

  async function sendProposal() {
    if (!lead) return;
    saveProposal("Saving PDF before send");
    let deliveryStatus = "PDF email logged";
    const canEmail = !lead.communicationPreferences?.dndAllChannels && lead.communicationPreferences?.email !== false;
    const pdf = await createPdf();
    const encodedPdf = pdf.output("datauristring").split(",")[1] ?? "";

    if (state.settings.resend.enabled && canEmail && lead.email) {
      const response = await fetch("/api/resend/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resend: state.settings.resend,
          toEmail: lead.email,
          toName: lead.contact,
          subject: `Proposal PDF for ${lead.title}`,
          text: `Hi ${lead.contact},\n\nAttached is the proposal PDF for ${lead.title}.\n\nRegards,\nSavePlanet Team`,
          attachments: [
            {
              ContentType: "application/pdf",
              Filename: `${slugify(lead.company)}-${lead.id}-proposal.pdf`,
              Base64Content: encodedPdf,
            },
          ],
        }),
      });
      deliveryStatus = response.ok ? "Proposal PDF sent and logged" : "Proposal saved, Resend PDF send failed";
    } else if (!canEmail) {
      deliveryStatus = "Proposal saved, email blocked by lead preferences";
    } else if (!state.settings.resend.enabled) {
      deliveryStatus = "Proposal saved, enable Resend in settings to send PDF";
    }

    setState({
      ...state,
      leads: state.leads.map((item) =>
        item.id === lead.id
          ? {
              ...item,
              proposal: { pages, elements: pages[0]?.elements ?? [], updatedAt: "Now" },
              mails: [
                ...item.mails,
                {
                  id: `M-${item.mails.length + 1}`,
                  subject: "Proposal PDF sent",
                  body: deliveryStatus,
                  direction: "Out",
                  createdAt: "Now",
                },
              ],
            }
          : item,
      ),
    });
    setStatus(deliveryStatus);
  }

  return (
    <CrmShell>
      <PageHeader
        eyebrow="Proposal PDF maker"
        title={lead ? `Proposal for ${lead.company}` : "Lead not found"}
        actions={<ButtonLink href={`/leads/${id}`}>Back to lead</ButtonLink>}
      />
      {lead ? (
        <div className="flex min-h-[calc(100vh-120px)] flex-col bg-[#f6f8fc]">
          <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-[#d9e2f2] bg-white px-4 py-3 shadow-sm">
            {tools.map((tool) => (
              <button key={tool.type} onClick={() => addBlock(tool.type)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#c7d3e8] bg-white px-3 text-sm font-semibold text-[#0f172a] hover:border-[#003CBB] hover:text-[#003CBB]">
                {tool.icon}
                {tool.label}
              </button>
            ))}
            <button onClick={addPage} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#003CBB] px-3 text-sm font-semibold text-white">
              <Plus size={16} />
              New page
            </button>
            <span className="ml-auto rounded-lg bg-[#eef4ff] px-3 py-2 text-sm font-semibold text-[#003CBB]">{status}</span>
            <button onClick={() => saveProposal()} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#003CBB] px-3 text-sm font-semibold text-white">
              <Save size={16} />
              Save
            </button>
            <button onClick={downloadProposal} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#c7d3e8] bg-white px-3 text-sm font-semibold text-[#003CBB]">
              <ArrowDownToLine size={16} />
              PDF
            </button>
            <button onClick={sendProposal} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#0f172a] px-3 text-sm font-semibold text-white">
              <Mail size={16} />
              Send PDF
            </button>
          </div>

          <div className="grid flex-1 grid-cols-[1fr_310px] overflow-hidden">
            <main
              tabIndex={0}
              onKeyDown={handleKeyboard}
              onPointerMove={moveAction}
              onPointerUp={() => setAction(null)}
              onPointerLeave={() => setAction(null)}
              className="overflow-auto p-8 outline-none"
            >
              <div className="mx-auto grid w-fit gap-8">
                {pages.map((page, pageIndex) => (
                  <section key={page.id} className="grid gap-2">
                    <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.12em] text-[#6b7280]">
                      <span>Page {pageIndex + 1}</span>
                      <span>{page.elements.length} blocks</span>
                    </div>
                    <div
                      data-page-id={page.id}
                      onPointerDown={() => setSelected({ pageId: page.id, elementId: "" })}
                      className="relative bg-white shadow-xl ring-1 ring-[#d9e2f2]"
                      style={{ width: pageWidth, height: pageHeight }}
                    >
                      {page.elements.map((element) => (
                        <DocumentBlock
                          key={element.id}
                          pageId={page.id}
                          element={element}
                          selected={selected.pageId === page.id && selected.elementId === element.id}
                          onSelect={() => setSelected({ pageId: page.id, elementId: element.id })}
                          onMoveStart={(event) => startMove(page.id, element, event)}
                          onResizeStart={(event) => startResize(page.id, element, event)}
                          onContentChange={(content) => updateElement(page.id, element.id, { content })}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </main>

            <aside className="overflow-auto border-l border-[#d9e2f2] bg-white p-4">
              <div className="mb-5 border-b border-[#e5edf7] pb-4">
                <h2 className="text-sm font-semibold text-[#0f172a]">Import saved products</h2>
                <p className="mt-2 text-xs text-[#657267]">Products are stored in the Products module. Click once to place one on the current PDF page.</p>
                <div className="mt-3 grid gap-2">
                  {state.products.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => importProduct(product)}
                      className="rounded-lg border border-[#d9e2f2] bg-white p-3 text-left transition hover:border-[#003CBB] hover:bg-[#eef4ff]"
                    >
                      <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-[#003CBB]">{product.category}</span>
                      <span className="mt-1 block text-sm font-semibold text-[#0f172a]">{product.productName}</span>
                      <span className="mt-1 block text-xs text-[#657267]">{product.brandName} · {currency(product.price)}</span>
                    </button>
                  ))}
                </div>
              </div>
              <h2 className="text-sm font-semibold text-[#0f172a]">Format block</h2>
              <p className="mt-2 text-xs text-[#657267]">Arrow keys move blocks. Hold Shift for bigger steps. Hold Alt with arrow keys to resize.</p>
              {selectedElement ? (
                <div className="mt-4 grid gap-3">
                  {isTextual(selectedElement.type) ? (
                    <label className="grid gap-1 text-xs font-semibold text-[#4b5f7a]">
                      Text
                      <textarea
                        value={selectedElement.content}
                        onChange={(event) => updateElement(selected.pageId, selected.elementId, { content: event.target.value })}
                        className="min-h-28 rounded-lg border border-[#c7d3e8] p-2 text-sm font-normal text-[#0f172a]"
                      />
                    </label>
                  ) : null}
                  <div className="grid grid-cols-2 gap-2">
                    <NumberField label="X" value={selectedElement.x} onChange={(value) => updateElement(selected.pageId, selected.elementId, { x: value })} />
                    <NumberField label="Y" value={selectedElement.y} onChange={(value) => updateElement(selected.pageId, selected.elementId, { y: value })} />
                    <NumberField label="Width" value={selectedElement.width} onChange={(value) => updateElement(selected.pageId, selected.elementId, { width: value })} />
                    <NumberField label="Height" value={selectedElement.height} onChange={(value) => updateElement(selected.pageId, selected.elementId, { height: value })} />
                    <NumberField label="Font" value={selectedElement.fontSize} onChange={(value) => updateElement(selected.pageId, selected.elementId, { fontSize: value })} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <ColorField label="Fill" value={selectedElement.fill} onChange={(value) => updateElement(selected.pageId, selected.elementId, { fill: value })} />
                    <ColorField label="Line" value={selectedElement.stroke} onChange={(value) => updateElement(selected.pageId, selected.elementId, { stroke: value })} />
                    <ColorField label="Text" value={selectedElement.color} onChange={(value) => updateElement(selected.pageId, selected.elementId, { color: value })} />
                  </div>
                  <button onClick={deleteSelected} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 text-sm font-semibold text-red-600">
                    <Trash2 size={16} />
                    Delete block
                  </button>
                </div>
              ) : (
                <p className="mt-4 rounded-lg bg-[#f6f8fc] p-3 text-sm text-[#657267]">Select a block to edit it. Use the top toolbar to add document blocks and shapes.</p>
              )}
            </aside>
          </div>
        </div>
      ) : null}
    </CrmShell>
  );
}

function DocumentBlock({
  pageId,
  element,
  selected,
  onSelect,
  onMoveStart,
  onResizeStart,
  onContentChange,
}: {
  pageId: string;
  element: ProposalElement;
  selected: boolean;
  onSelect: () => void;
  onMoveStart: (event: React.PointerEvent<HTMLElement>) => void;
  onResizeStart: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onContentChange: (content: string) => void;
}) {
  const style = {
    left: element.x,
    top: element.y,
    width: element.width,
    height: element.height,
    color: element.color,
    fontSize: element.fontSize,
    backgroundColor: element.type === "line" ? "transparent" : element.fill,
    borderColor: selected ? "#003CBB" : element.stroke,
  };

  return (
    <div
      data-page-id={pageId}
      onPointerDown={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      className={`absolute border ${selected ? "ring-2 ring-[#003CBB]" : ""} ${element.type === "circle" ? "rounded-full" : "rounded"}`}
      style={style}
    >
      <button
        type="button"
        onPointerDown={onMoveStart}
        className={`absolute -left-3 -top-3 z-10 grid h-6 w-6 place-items-center rounded-full bg-[#003CBB] text-white shadow ${selected ? "opacity-100" : "opacity-0"}`}
        aria-label="Move block"
      >
        <GripVertical size={14} />
      </button>
      <BlockContent element={element} onContentChange={onContentChange} />
      {selected ? (
        <button
          type="button"
          onPointerDown={onResizeStart}
          className="absolute -bottom-2 -right-2 h-4 w-4 rounded-sm border border-white bg-[#003CBB] shadow"
          aria-label="Resize block"
        />
      ) : null}
    </div>
  );
}

function BlockContent({ element, onContentChange }: { element: ProposalElement; onContentChange: (content: string) => void }) {
  if (element.type === "line") {
    return <span className="absolute left-0 top-1/2 block h-0.5 w-full -translate-y-1/2" style={{ backgroundColor: element.stroke }} />;
  }
  if (element.type === "table") {
    const rows = element.content.split("\n").map((row) => row.split("|"));
    return (
      <div className="grid h-full grid-rows-3 overflow-hidden text-[11px]">
        {rows.map((row, rowIndex) => (
          <div key={`${element.id}-${rowIndex}`} className="grid grid-cols-3 border-b border-[#c7d3e8] last:border-b-0">
            {row.map((cell, cellIndex) => (
              <div key={`${element.id}-${rowIndex}-${cellIndex}`} className="border-r border-[#c7d3e8] p-2 last:border-r-0">
                {cell}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }
  if (element.type === "image") {
    return <div className="grid h-full place-items-center p-3 text-center text-sm font-semibold text-[#657267]">Image / logo block</div>;
  }
  if (element.type === "product") {
    const lines = element.content.split("\n");
    return (
      <div className="grid h-full grid-cols-[88px_1fr] overflow-hidden text-[#0f172a]">
        <div className="relative m-2 grid place-items-center overflow-hidden rounded border border-[#d9e2f2] bg-[#f6f8fc] text-center text-[10px] font-semibold text-[#657267]">
          {element.imageUrl ? <Image src={element.imageUrl} alt={lines[1] ?? "Product"} fill className="object-cover" unoptimized /> : "Product image"}
        </div>
        <div className="overflow-hidden p-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#003CBB]">{lines[0]}</p>
          <p className="mt-1 font-semibold">{lines[1]}</p>
          <p className="text-xs text-[#657267]">{lines[2]}</p>
          <p className="mt-1 text-sm font-semibold">{lines[3]}</p>
          <p className="mt-1 text-xs leading-4 text-[#4b5f7a]">{lines.slice(4).join(" ")}</p>
        </div>
      </div>
    );
  }
  if (!isTextual(element.type)) return null;
  return (
    <div
      contentEditable
      suppressContentEditableWarning
      onBlur={(event) => onContentChange(event.currentTarget.innerText)}
      className="h-full overflow-hidden whitespace-pre-wrap p-2 leading-snug outline-none"
    >
      {element.content}
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-[#4b5f7a]">
      {label}
      <input type="number" value={Math.round(value)} onChange={(event) => onChange(Number(event.target.value))} className="h-9 rounded-lg border border-[#c7d3e8] px-2 text-sm font-normal text-[#0f172a]" />
    </label>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-[#4b5f7a]">
      {label}
      <input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded-lg border border-[#c7d3e8] bg-white p-1" />
    </label>
  );
}

function buildProposalPages(lead: Lead): ProposalPageData[] {
  if (lead.proposal?.pages?.length) return lead.proposal.pages;
  if (lead.proposal?.elements?.length) return [{ id: "page-1", elements: lead.proposal.elements }];
  return [
    {
      id: "page-1",
      elements: [
        createFixedElement("header", "heading", pagePadding, 42, 320, 42, "SavePlanet Proposal", "#ffffff", "#ffffff", "#003CBB", 25),
        createFixedElement("title", "heading", pagePadding, 104, 410, 66, lead.title, "#ffffff", "#ffffff", "#0f172a", 22),
        createFixedElement("client", "client", pagePadding, 184, 238, 92, `${lead.company}\n${lead.contact}\n${lead.email}\n${lead.phone}`, "#eef4ff", "#c7d3e8", "#0f172a", 11),
        createFixedElement("amount", "amount", 315, 184, 238, 92, `Project value\n${currency(lead.amount)}\nSuccess chance ${lead.probability}%`, "#003CBB", "#003CBB", "#ffffff", 13),
        createFixedElement("body", "paragraph", pagePadding, 318, 510, 190, `Dear ${lead.contact},\n\nThank you for discussing ${lead.title} with SavePlanet. This proposal outlines the recommended scope, implementation support, reporting, and service plan.\n\nNext action: ${lead.nextAction}`, "#ffffff", "#c7d3e8", "#0f172a", 12),
        createFixedElement("table", "table", pagePadding, 548, 510, 112, `Item|Qty|Amount\n${lead.title}|1|${currency(lead.amount)}\nTotal||${currency(lead.amount)}`, "#ffffff", "#c7d3e8", "#0f172a", 11),
        createFixedElement("signature", "signature", pagePadding, 708, 220, 52, "Prepared by SavePlanet Team", "#ffffff", "#c7d3e8", "#0f172a", 12),
      ],
    },
  ];
}

function createFixedElement(id: string, type: ProposalElementType, x: number, y: number, width: number, height: number, content: string, fill: string, stroke: string, color: string, fontSize: number): ProposalElement {
  return { id, type, x, y, width, height, content, fill, stroke, color, fontSize };
}

function createElement(type: ProposalElementType, lead: Lead, index: number): ProposalElement {
  const id = `${type}-${index}`;
  const base = { id, type, x: pagePadding + index * 4, y: 96 + index * 4, width: 220, height: 76, fill: "#ffffff", stroke: "#c7d3e8", color: "#0f172a", fontSize: 12 };
  if (type === "heading") return { ...base, width: 360, height: 44, content: "New proposal heading", fontSize: 22, stroke: "#ffffff" };
  if (type === "paragraph" || type === "text") return { ...base, width: 420, height: 120, content: "Write proposal content here." };
  if (type === "client") return { ...base, content: `${lead.company}\n${lead.contact}\n${lead.email}`, fill: "#eef4ff" };
  if (type === "amount") return { ...base, content: `Project value\n${currency(lead.amount)}`, fill: "#003CBB", stroke: "#003CBB", color: "#ffffff", fontSize: 14 };
  if (type === "table") return { ...base, width: 420, height: 110, content: `Item|Qty|Amount\n${lead.title}|1|${currency(lead.amount)}\nTotal||${currency(lead.amount)}` };
  if (type === "signature") return { ...base, content: "Authorized signature", height: 54 };
  if (type === "image") return { ...base, content: "", width: 220, height: 130, fill: "#f6f8fc" };
  if (type === "rect") return { ...base, content: "", fill: "#eef4ff" };
  if (type === "circle") return { ...base, width: 100, height: 100, content: "", fill: "#eef4ff" };
  return { ...base, width: 220, height: 24, content: "", fill: "#ffffff", stroke: "#003CBB" };
}

function createProductElement(product: Product, index: number): ProposalElement {
  return {
    id: `product-${product.id}-${index}`,
    type: "product",
    productId: product.id,
    imageUrl: product.imageUrl,
    x: pagePadding + index * 4,
    y: 120 + index * 4,
    width: 430,
    height: 142,
    content: `${product.category}\n${product.productName}\n${product.brandName}\n${currency(product.price)}\n${product.description}`,
    fill: "#ffffff",
    stroke: "#c7d3e8",
    color: "#0f172a",
    fontSize: 11,
  };
}

function renderPdfPages(pdf: PdfDocument, pages: ProposalPageData[]) {
  pages.forEach((page, index) => {
    if (index > 0) pdf.addPage();
    page.elements.forEach((element) => renderPdfElement(pdf, element));
  });
}

function renderPdfElement(pdf: PdfDocument, element: ProposalElement) {
  pdf.setFillColor(element.fill);
  pdf.setDrawColor(element.stroke);
  pdf.setTextColor(element.color);
  pdf.setFontSize(element.fontSize);
  if (element.type === "rect") pdf.rect(element.x, element.y, element.width, element.height, "FD");
  if (element.type === "circle") pdf.ellipse(element.x + element.width / 2, element.y + element.height / 2, element.width / 2, element.height / 2, "FD");
  if (element.type === "line") pdf.line(element.x, element.y + element.height / 2, element.x + element.width, element.y + element.height / 2);
  if (element.type === "table") renderPdfTable(pdf, element);
  if (element.type === "product") {
    renderPdfProduct(pdf, element);
    return;
  }
  if (element.type === "image") {
    pdf.rect(element.x, element.y, element.width, element.height, "FD");
    pdf.text("Image / logo block", element.x + 12, element.y + element.height / 2);
  }
  if (isTextual(element.type)) {
    pdf.rect(element.x, element.y, element.width, element.height, "FD");
    pdf.text(pdf.splitTextToSize(element.content, element.width - 16), element.x + 8, element.y + 18);
  }
}

function renderPdfProduct(pdf: PdfDocument, element: ProposalElement) {
  const lines = element.content.split("\n");
  pdf.rect(element.x, element.y, element.width, element.height, "FD");
  pdf.rect(element.x + 10, element.y + 10, 82, element.height - 20);
  pdf.setTextColor("#657267");
  pdf.setFontSize(9);
  pdf.text("Product image", element.x + 18, element.y + element.height / 2);
  pdf.setTextColor(element.color);
  pdf.setFontSize(9);
  pdf.text(lines[0] ?? "Product", element.x + 108, element.y + 22);
  pdf.setFontSize(14);
  pdf.text(lines[1] ?? "", element.x + 108, element.y + 42);
  pdf.setFontSize(10);
  pdf.text(lines[2] ?? "", element.x + 108, element.y + 58);
  pdf.setFontSize(12);
  pdf.text(lines[3] ?? "", element.x + 108, element.y + 78);
  pdf.setFontSize(9);
  pdf.text(pdf.splitTextToSize(lines.slice(4).join(" "), element.width - 122), element.x + 108, element.y + 98);
}

function renderPdfTable(pdf: PdfDocument, element: ProposalElement) {
  pdf.rect(element.x, element.y, element.width, element.height, "FD");
  const rows = element.content.split("\n").map((row) => row.split("|"));
  const rowHeight = element.height / Math.max(rows.length, 1);
  const colWidth = element.width / 3;
  rows.forEach((row, rowIndex) => {
    row.forEach((cell, cellIndex) => {
      const cellX = element.x + cellIndex * colWidth;
      const cellY = element.y + rowIndex * rowHeight;
      pdf.rect(cellX, cellY, colWidth, rowHeight);
      pdf.text(cell, cellX + 6, cellY + 16);
    });
  });
}

type PdfDocument = {
  addPage: () => void;
  setFillColor: (color: string) => void;
  setDrawColor: (color: string) => void;
  setTextColor: (color: string) => void;
  setFontSize: (size: number) => void;
  rect: (x: number, y: number, width: number, height: number, style?: string) => void;
  ellipse: (x: number, y: number, rx: number, ry: number, style?: string) => void;
  line: (x1: number, y1: number, x2: number, y2: number) => void;
  text: (text: string | string[], x: number, y: number) => void;
  splitTextToSize: (text: string, size: number) => string[];
};

function isTextual(type: ProposalElementType) {
  return type === "heading" || type === "paragraph" || type === "text" || type === "client" || type === "amount" || type === "signature" || type === "product";
}

function blockLabel(type: ProposalElementType) {
  return tools.find((tool) => tool.type === type)?.label ?? "Block";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
