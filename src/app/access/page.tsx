"use client";

import { deleteApp, initializeApp } from "firebase/app";
import { createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { FormEvent, useState } from "react";
import { CrmShell, PageHeader } from "@/components/crm-shell";
import { ModuleKey, TeamMember, moduleLabels } from "@/lib/crm-data";
import { firebaseConfig } from "@/lib/firebase";
import { useCrmStore } from "@/lib/use-crm-store";

const defaultModules: ModuleKey[] = ["dashboard", "leads"];

export default function AccessPage() {
  const { state, setState } = useCrmStore();
  const [message, setMessage] = useState("");

  async function addUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "");
    const password = String(form.get("password") || "");
    const selectedModules = (Object.keys(moduleLabels) as ModuleKey[]).filter((module) => form.get(module) === "on");

    try {
      const secondaryApp = initializeApp(firebaseConfig, `create-user-${Date.now()}`);
      const secondaryAuth = getAuth(secondaryApp);
      const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      await secondaryAuth.signOut();
      await deleteApp(secondaryApp);

      const member: TeamMember = {
        id: credential.user.uid,
        uid: credential.user.uid,
        name: String(form.get("name") || email),
        email,
        role: String(form.get("role") || "Sales Agent"),
        modules: selectedModules.length ? selectedModules : defaultModules,
        active: true,
      };

      setState({ ...state, team: [...state.team, member] });
      event.currentTarget.reset();
      setMessage(`User ${email} created and added to access manager.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create user");
    }
  }

  function toggleModule(memberId: string, module: ModuleKey) {
    setState({
      ...state,
      team: state.team.map((member) =>
        member.id === memberId
          ? {
              ...member,
              modules: member.modules.includes(module) ? member.modules.filter((item) => item !== module) : [...member.modules, module],
            }
          : member,
      ),
    });
  }

  function updateMember(memberId: string, updates: Partial<TeamMember>) {
    setState({
      ...state,
      team: state.team.map((member) => (member.id === memberId ? { ...member, ...updates } : member)),
    });
  }

  function removeAccess(memberId: string) {
    setState({
      ...state,
      team: state.team.filter((member) => member.id !== memberId),
      leads: state.leads.map((lead) => (lead.assignedTo === memberId ? { ...lead, assignedTo: "admin" } : lead)),
    });
    setMessage("CRM access removed. Firebase Auth account deletion needs server Admin SDK.");
  }

  return (
    <CrmShell>
      <PageHeader eyebrow="Access manager" title="Users, roles and module access" />
      <div className="grid gap-6 p-4 md:p-8 xl:grid-cols-[420px_1fr]">
        <form onSubmit={addUser} className="rounded-lg border border-[#dce3d5] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <UserPlus size={18} />
            <h2 className="font-semibold">Add Firebase user</h2>
          </div>
          <div className="mt-4 grid gap-3">
            <Input name="name" label="Full name" required />
            <Input name="email" label="Email login" type="email" required />
            <Input name="password" label="Temporary password" type="password" minLength={6} required />
            <label className="space-y-1 text-sm">
              <span className="font-medium text-[#657267]">Role</span>
              <select name="role" className="h-11 w-full rounded-lg border border-[#d7dfd0] px-3 outline-none">
                <option>Sales Agent</option>
                <option>Accounts</option>
                <option>Lead Coordinator</option>
                <option>Admin</option>
              </select>
            </label>
          </div>
          <div className="mt-4">
            <p className="text-sm font-medium text-[#657267]">Module access</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(Object.keys(moduleLabels) as ModuleKey[]).map((module) => (
                <label key={module} className="flex items-center gap-2 rounded-lg border border-[#d7dfd0] p-2 text-sm">
                  <input name={module} type="checkbox" defaultChecked={defaultModules.includes(module)} />
                  {moduleLabels[module]}
                </label>
              ))}
            </div>
          </div>
          {message ? <p className="mt-4 rounded-lg bg-[#eef4ff] p-3 text-sm font-medium text-[#003CBB]">{message}</p> : null}
          <button className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#003CBB] px-4 text-sm font-semibold text-white">
            <UserPlus size={16} /> Create user
          </button>
        </form>

        <section className="space-y-3">
          {state.team.map((member) => (
            <article key={member.id} className="rounded-lg border border-[#dce3d5] bg-white p-4 shadow-sm">
              <div className="grid gap-4 xl:grid-cols-[280px_1fr_120px]">
                <div>
                  <input
                    value={member.name}
                    onChange={(event) => updateMember(member.id, { name: event.target.value })}
                    className="w-full text-lg font-semibold outline-none"
                  />
                  <input
                    value={member.email ?? ""}
                    onChange={(event) => updateMember(member.id, { email: event.target.value })}
                    className="mt-1 w-full text-sm text-[#657267] outline-none"
                    placeholder="email"
                  />
                  <select value={member.role} onChange={(event) => updateMember(member.id, { role: event.target.value })} className="mt-3 h-9 w-full rounded-lg border border-[#d7dfd0] px-2 text-sm outline-none">
                    <option>Admin</option>
                    <option>Sales Agent</option>
                    <option>Accounts</option>
                    <option>Lead Coordinator</option>
                  </select>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(moduleLabels) as ModuleKey[]).map((module) => (
                    <button
                      key={module}
                      onClick={() => toggleModule(member.id, module)}
                      className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium ${
                        member.modules.includes(module) ? "border-[#12201b] bg-[#003CBB] text-white" : "border-[#d7dfd0] bg-white text-[#657267]"
                      }`}
                    >
                      <ShieldCheck size={15} /> {moduleLabels[module]}
                    </button>
                  ))}
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => updateMember(member.id, { active: !member.active })}
                    className="h-9 rounded-lg border border-[#d7dfd0] px-3 text-sm font-semibold"
                  >
                    {member.active ? "Active" : "Inactive"}
                  </button>
                  <button onClick={() => removeAccess(member.id)} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-rose-600 px-3 text-sm font-semibold text-white">
                    <Trash2 size={15} /> Remove
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      </div>
    </CrmShell>
  );
}

function Input({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="space-y-1 text-sm">
      <span className="font-medium text-[#657267]">{label}</span>
      <input {...props} className="h-11 w-full rounded-lg border border-[#d7dfd0] px-3 outline-none" />
    </label>
  );
}
