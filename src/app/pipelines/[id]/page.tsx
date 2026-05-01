"use client";

import { useParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { ButtonLink, CrmShell, PageHeader } from "@/components/crm-shell";
import { slugify } from "@/lib/crm-data";
import { useCrmStore } from "@/lib/use-crm-store";

export default function PipelineOptionsPage() {
  const { id } = useParams<{ id: string }>();
  const { state, setState } = useCrmStore();
  const [stageName, setStageName] = useState("");
  const pipeline = state.pipelines.find((item) => item.id === id);

  function addStage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pipeline || !stageName.trim()) return;
    setState({
      ...state,
      pipelines: state.pipelines.map((item) =>
        item.id === pipeline.id
          ? { ...item, stages: [...item.stages, { id: `${slugify(stageName)}-${Date.now().toString(36)}`, name: stageName, color: "bg-teal-500" }] }
          : item,
      ),
    });
    setStageName("");
  }

  function updateName(value: string) {
    if (!pipeline) return;
    setState({ ...state, pipelines: state.pipelines.map((item) => (item.id === pipeline.id ? { ...item, name: value } : item)) });
  }

  return (
    <CrmShell>
      <PageHeader eyebrow="Pipeline options" title={pipeline?.name ?? "Pipeline not found"} actions={<ButtonLink href="/leads">Open Kanban</ButtonLink>} />
      {pipeline ? (
        <div className="grid gap-6 p-4 md:p-8 xl:grid-cols-[420px_1fr]">
          <section className="rounded-lg border border-[#dce3d5] bg-white p-5 shadow-sm">
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-[#657267]">Pipeline name</span>
              <input value={pipeline.name} onChange={(event) => updateName(event.target.value)} className="h-11 w-full rounded-lg border border-[#d7dfd0] px-3 outline-none" />
            </label>
            <form onSubmit={addStage} className="mt-5 space-y-2">
              <label className="block space-y-1 text-sm">
                <span className="font-medium text-[#657267]">Add stage</span>
                <input value={stageName} onChange={(event) => setStageName(event.target.value)} className="h-11 w-full rounded-lg border border-[#d7dfd0] px-3 outline-none" placeholder="Stage name" />
              </label>
              <button className="h-10 rounded-lg bg-[#003CBB] px-4 text-sm font-semibold text-white">Add stage</button>
            </form>
          </section>
          <section className="rounded-lg border border-[#dce3d5] bg-white p-5 shadow-sm">
            <h2 className="font-semibold">Stages</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {pipeline.stages.map((stage, index) => (
                <div key={stage.id} className="rounded-lg border border-[#edf2e9] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#657267]">Step {index + 1}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`size-2.5 rounded-full ${stage.color}`} />
                    <p className="font-semibold">{stage.name}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </CrmShell>
  );
}
