"use client";

import { useRouter } from "next/navigation";
import { FormEvent } from "react";
import { CrmShell, PageHeader } from "@/components/crm-shell";
import { Pipeline, slugify } from "@/lib/crm-data";
import { useCrmStore } from "@/lib/use-crm-store";

export default function NewPipelinePage() {
  const { state, setState } = useCrmStore();
  const router = useRouter();

  function createPipeline(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "New Pipeline");
    const id = `${slugify(name)}-${Date.now().toString(36)}`;
    const pipeline: Pipeline = {
      id,
      name,
      description: String(form.get("description") || "Custom lead workflow."),
      stages: [
        { id: `${id}-new`, name: "New Lead", color: "bg-sky-500" },
        { id: `${id}-discussion`, name: "In Discussion", color: "bg-amber-500" },
        { id: `${id}-closed`, name: "Closed Won", color: "bg-emerald-500" },
      ],
    };
    setState({ ...state, pipelines: [...state.pipelines, pipeline] });
    router.push(`/pipelines/${id}`);
  }

  return (
    <CrmShell>
      <PageHeader eyebrow="Pipeline manager" title="Create pipeline" />
      <form onSubmit={createPipeline} className="m-4 max-w-3xl space-y-4 rounded-lg border border-[#dce3d5] bg-white p-5 shadow-sm md:m-8">
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-[#657267]">Pipeline name</span>
          <input name="name" required className="h-11 w-full rounded-lg border border-[#d7dfd0] px-3 outline-none" />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-[#657267]">Description</span>
          <textarea name="description" className="min-h-24 w-full rounded-lg border border-[#d7dfd0] p-3 outline-none" />
        </label>
        <button className="h-11 rounded-lg bg-[#003CBB] px-5 text-sm font-semibold text-white">Create pipeline</button>
      </form>
    </CrmShell>
  );
}
