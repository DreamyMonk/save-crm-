"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { ButtonLink, CrmShell, PageHeader } from "@/components/crm-shell";
import { currency } from "@/lib/crm-data";
import { useCrmStore } from "@/lib/use-crm-store";

export default function PipelinesPage() {
  const { state } = useCrmStore();

  return (
    <CrmShell>
      <PageHeader eyebrow="Pipeline manager" title="Pipelines" actions={<ButtonLink href="/pipelines/new" variant="lime"><Plus size={16} /> New pipeline</ButtonLink>} />
      <div className="grid gap-4 p-4 md:p-8 xl:grid-cols-2">
        {state.pipelines.map((pipeline) => {
          const leads = state.leads.filter((lead) => lead.pipelineId === pipeline.id);
          const amount = leads.reduce((sum, lead) => sum + lead.amount, 0);
          return (
            <Link key={pipeline.id} href={`/pipelines/${pipeline.id}`} className="rounded-lg border border-[#dce3d5] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">{pipeline.name}</h2>
                  <p className="mt-1 text-sm text-[#657267]">{pipeline.description}</p>
                </div>
                <span className="rounded-md bg-[#eef4ff] px-2 py-1 text-xs font-semibold">{pipeline.stages.length} stages</span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <Box label="Leads" value={String(leads.length)} />
                <Box label="Value" value={currency(amount)} />
              </div>
            </Link>
          );
        })}
      </div>
    </CrmShell>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#eef4ff] p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#657267]">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
