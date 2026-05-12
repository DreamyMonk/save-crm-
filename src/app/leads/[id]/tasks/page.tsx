"use client";

import { useParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { ButtonLink, CrmShell, PageHeader } from "@/components/crm-shell";
import { RichTextEditor } from "@/components/rich-text-editor";
import { Note, Task } from "@/lib/crm-data";
import { htmlToPlainText } from "@/lib/text";
import { canAccessLead, useCurrentTeamMember } from "@/lib/use-current-team-member";
import { useCrmStore } from "@/lib/use-crm-store";

export default function LeadTasksPage() {
  const { id } = useParams<{ id: string }>();
  const { state, setState } = useCrmStore();
  const [taskTitle, setTaskTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const lead = state.leads.find((item) => item.id === id);
  const { member: currentMember, ready: memberReady } = useCurrentTeamMember(state.team);
  const hasLeadAccess = memberReady && canAccessLead(currentMember, lead);

  function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lead || !taskTitle.trim()) return;
    const task: Task = { id: `T-${Date.now()}`, title: taskTitle, due: "Today", status: "Open" };
    setState({ ...state, leads: state.leads.map((item) => (item.id === lead.id ? { ...item, updatedAt: new Date().toISOString(), tasks: [...item.tasks, task] } : item)) });
    setTaskTitle("");
  }

  function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lead || !noteBody.trim()) return;
    const note: Note = { id: `N-${Date.now()}`, body: noteBody, createdAt: "Now" };
    setState({ ...state, leads: state.leads.map((item) => (item.id === lead.id ? { ...item, updatedAt: new Date().toISOString(), notes: [...item.notes, note] } : item)) });
    setNoteBody("");
  }

  return (
    <CrmShell>
      <PageHeader eyebrow="Tasks and notes" title={lead && hasLeadAccess ? lead.title : memberReady ? "No lead access" : "Checking lead access"} actions={<ButtonLink href={`/leads/${id}`}>Back to lead</ButtonLink>} />
      {lead && hasLeadAccess ? (
        <div className="grid gap-6 p-4 md:p-8 xl:grid-cols-2">
          <section className="rounded-lg border border-[#dce3d5] bg-white p-5 shadow-sm">
            <h2 className="font-semibold">Tasks</h2>
            <form onSubmit={addTask} className="mt-4 flex gap-2">
              <input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Add task for yourself" className="h-11 min-w-0 flex-1 rounded-lg border border-[#d7dfd0] px-3 outline-none" />
              <button className="rounded-lg bg-[#003CBB] px-4 text-sm font-semibold text-white">Add</button>
            </form>
            <div className="mt-4 space-y-3">
              {lead.tasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#edf2e9] p-3">
                  <div>
                    <p className="font-medium">{task.title}</p>
                    <p className="text-sm text-[#657267]">{task.due}</p>
                  </div>
                  <span className="rounded-md bg-[#eef4ff] px-2 py-1 text-xs font-semibold">{task.status}</span>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-lg border border-[#dce3d5] bg-white p-5 shadow-sm">
            <h2 className="font-semibold">Notes</h2>
            <form onSubmit={addNote} className="mt-4">
              <RichTextEditor value={noteBody} onChange={setNoteBody} placeholder="Add note" minHeight={170} />
              <button className="mt-3 rounded-lg bg-[#003CBB] px-4 py-2 text-sm font-semibold text-white">Save note</button>
            </form>
            <div className="mt-4 space-y-3">
              {lead.notes.map((note) => (
                <div key={note.id} className="rounded-lg border border-[#edf2e9] p-3">
                  <p className="text-sm leading-6">{htmlToPlainText(note.body)}</p>
                  <p className="mt-2 text-xs text-[#657267]">{note.createdAt}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : memberReady ? (
        <div className="p-4 text-sm font-semibold text-[#657267] md:p-8">No access to this lead.</div>
      ) : null}
    </CrmShell>
  );
}
