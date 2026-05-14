"use client";

import { useParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { ButtonLink, CrmShell, PageHeader } from "@/components/crm-shell";
import { slugify } from "@/lib/crm-data";
import { useCrmStore } from "@/lib/use-crm-store";

export default function PipelineOptionsPage() {
  const { id } = useParams<{ id: string }>();
  const { state, setState } = useCrmStore();
  const [stageName, setStageName] = useState("");
  const [message, setMessage] = useState("");
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
    setMessage(`${stageName} added.`);
  }

  function updateName(value: string) {
    if (!pipeline) return;
    setState({ ...state, pipelines: state.pipelines.map((item) => (item.id === pipeline.id ? { ...item, name: value } : item)) });
  }

  function updateStageName(stageId: string, value: string) {
    if (!pipeline) return;
    setState((currentState) => ({
      ...currentState,
      pipelines: currentState.pipelines.map((item) =>
        item.id === pipeline.id
          ? {
              ...item,
              stages: item.stages.map((stage) => (stage.id === stageId ? { ...stage, name: value } : stage)),
            }
          : item,
      ),
    }));
    setMessage("Stage name updated.");
  }

  function moveStage(stageId: string, direction: -1 | 1) {
    if (!pipeline) return;
    setState((currentState) => ({
      ...currentState,
      pipelines: currentState.pipelines.map((item) => {
        if (item.id !== pipeline.id) return item;
        const index = item.stages.findIndex((stage) => stage.id === stageId);
        const nextIndex = index + direction;
        if (index < 0 || nextIndex < 0 || nextIndex >= item.stages.length) return item;
        const stages = [...item.stages];
        [stages[index], stages[nextIndex]] = [stages[nextIndex], stages[index]];
        return { ...item, stages };
      }),
    }));
    setMessage("Stage order updated.");
  }

  function deleteStage(stageId: string) {
    if (!pipeline || pipeline.stages.length <= 1) {
      setMessage("A pipeline needs at least one stage.");
      return;
    }
    setState((currentState) => {
      const currentPipeline = currentState.pipelines.find((item) => item.id === pipeline.id);
      if (!currentPipeline || currentPipeline.stages.length <= 1) return currentState;
      const remainingStages = currentPipeline.stages.filter((stage) => stage.id !== stageId);
      const fallbackStageId = remainingStages[0]?.id ?? currentPipeline.stages[0].id;
      return {
        ...currentState,
        pipelines: currentState.pipelines.map((item) => (item.id === pipeline.id ? { ...item, stages: remainingStages } : item)),
        leads: currentState.leads.map((lead) => (lead.pipelineId === pipeline.id && lead.stageId === stageId ? { ...lead, stageId: fallbackStageId, updatedAt: new Date().toISOString() } : lead)),
      };
    });
    setMessage("Stage deleted. Leads from that stage moved to the first available stage.");
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
            {message ? <p className="mt-4 rounded-lg bg-[#eef4ff] p-3 text-sm font-semibold text-[#003CBB]">{message}</p> : null}
          </section>
          <section className="rounded-lg border border-[#dce3d5] bg-white p-5 shadow-sm">
            <h2 className="font-semibold">Stages</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {pipeline.stages.map((stage, index) => (
                <div key={stage.id} className="rounded-lg border border-[#edf2e9] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#657267]">Step {index + 1}</p>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => moveStage(stage.id, -1)} disabled={index === 0} className="grid size-8 place-items-center rounded-lg border border-[#d7dfd0] text-[#003CBB] disabled:cursor-not-allowed disabled:opacity-40" title="Move stage left/up">
                        <ArrowUp size={15} />
                      </button>
                      <button type="button" onClick={() => moveStage(stage.id, 1)} disabled={index === pipeline.stages.length - 1} className="grid size-8 place-items-center rounded-lg border border-[#d7dfd0] text-[#003CBB] disabled:cursor-not-allowed disabled:opacity-40" title="Move stage right/down">
                        <ArrowDown size={15} />
                      </button>
                      <button type="button" onClick={() => deleteStage(stage.id)} disabled={pipeline.stages.length <= 1} className="grid size-8 place-items-center rounded-lg bg-rose-600 text-white disabled:cursor-not-allowed disabled:bg-rose-300" title="Delete stage">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <span className={`size-2.5 shrink-0 rounded-full ${stage.color}`} />
                    <input value={stage.name} onChange={(event) => updateStageName(stage.id, event.target.value)} className="h-10 min-w-0 flex-1 rounded-lg border border-[#d7dfd0] px-3 text-sm font-semibold outline-none" />
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
