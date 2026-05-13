"use client";

import { deleteApp, initializeApp } from "firebase/app";
import { createUserWithEmailAndPassword, getAuth, onAuthStateChanged, User } from "firebase/auth";
import { ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { CrmShell, PageHeader } from "@/components/crm-shell";
import { ModuleKey, TeamMember, moduleLabels } from "@/lib/crm-data";
import { firebaseConfig, getFirebaseAuth } from "@/lib/firebase";
import { useCrmStore } from "@/lib/use-crm-store";

const defaultModules: ModuleKey[] = ["dashboard", "leads"];
const savePlanetLogoUrl = "https://saveplanet.com.au/images/SAVEPLANET-LOGO-7%20(1).webp";

export default function AccessPage() {
  const { state, setState } = useCrmStore();
  const [message, setMessage] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const createUserCounter = useRef(0);

  useEffect(() => {
    return onAuthStateChanged(getFirebaseAuth(), setCurrentUser);
  }, []);

  async function addUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setMessage("");
    setCreatingUser(true);
    const form = new FormData(formElement);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    const name = String(form.get("name") || email).trim();
    const role = String(form.get("role") || "Sales Agent");
    const selectedModules = (Object.keys(moduleLabels) as ModuleKey[]).filter((module) => form.get(module) === "on");
    const modules = selectedModules.length ? selectedModules : defaultModules;

    let secondaryApp: ReturnType<typeof initializeApp> | undefined;
    try {
      createUserCounter.current += 1;
      secondaryApp = initializeApp(firebaseConfig, `create-user-${safeFirebaseAppName(email)}-${createUserCounter.current}`);
      const secondaryAuth = getAuth(secondaryApp);
      const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      await secondaryAuth.signOut();
      upsertAccessMember({
        id: existingMemberId(state.team, email) ?? credential.user.uid,
        uid: credential.user.uid,
        name,
        email,
        localPassword: password,
        localPasswordUpdatedAt: new Date().toISOString(),
        role,
        modules,
        active: true,
        accessUpdatedAt: new Date().toISOString(),
      });
      void sendAccessCreatedEmail({
        resend: state.settings.resend,
        email,
        name,
        password,
        role,
        modules,
      });
      formElement.reset();
      setMessage(`User ${email} created and added to access manager.`);
    } catch (error) {
      const code = firebaseErrorCode(error);
      if (code === "auth/email-already-in-use") {
        upsertAccessMember({
          id: existingMemberId(state.team, email) ?? fallbackMemberId(email),
          name,
          email,
          localPassword: password,
          localPasswordUpdatedAt: new Date().toISOString(),
          role,
          modules,
          active: true,
          accessUpdatedAt: new Date().toISOString(),
        });
        void sendAccessCreatedEmail({
          resend: state.settings.resend,
          email,
          name,
          password,
          role,
          modules,
        });
        formElement.reset();
        setMessage(`${email} already has a Firebase login. CRM access was updated with this temporary password.`);
        return;
      }
      setMessage(error instanceof Error ? error.message : "Could not create user");
    } finally {
      if (secondaryApp) await deleteApp(secondaryApp).catch(() => undefined);
      setCreatingUser(false);
    }
  }

  function upsertAccessMember(member: TeamMember) {
    const existingId = existingMemberId(state.team, member.email ?? "");
    setState((currentState) => {
      const currentExistingId = existingMemberId(currentState.team, member.email ?? "") ?? existingId;
      const memberKeys = accessMemberKeys(member);
      return {
        ...currentState,
        deletedTeamMemberKeys: (currentState.deletedTeamMemberKeys ?? []).filter((key) => !memberKeys.includes(key)),
        team: currentExistingId
          ? currentState.team.map((item) => (item.id === currentExistingId ? { ...item, ...member, id: currentExistingId } : item))
          : [member, ...currentState.team],
      };
    });
  }

  function toggleModule(memberId: string, module: ModuleKey) {
    const targetMember = state.team.find((member) => member.id === memberId);
    if (targetMember && isProtectedAdmin(targetMember)) {
      setMessage("The built-in admin keeps full access and cannot be changed.");
      return;
    }
    if (targetMember && isCurrentMember(targetMember, currentUser) && module === "access" && targetMember.modules.includes("access")) {
      setMessage("You cannot remove your own Access module while signed in.");
      return;
    }
    setState((currentState) => {
      const nextState = {
        ...currentState,
        team: currentState.team.map((member) =>
          member.id === memberId
            ? {
                ...member,
                modules: member.modules.includes(module) ? member.modules.filter((item) => item !== module) : [...member.modules, module],
                accessUpdatedAt: new Date().toISOString(),
              }
            : member,
        ),
      };
      setMessage("Module access updated and will be enforced on next navigation.");
      return nextState;
    });
  }

  function updateMember(memberId: string, updates: Partial<TeamMember>) {
    const targetMember = state.team.find((member) => member.id === memberId);
    if (targetMember && isProtectedAdmin(targetMember)) {
      setMessage("The built-in admin account cannot be edited or deactivated.");
      return;
    }
    if (targetMember && isCurrentMember(targetMember, currentUser) && updates.active === false) {
      setMessage("You cannot deactivate your own access while signed in.");
      return;
    }
    setState((currentState) => {
      const nextState = {
        ...currentState,
        team: currentState.team.map((member) => (member.id === memberId ? { ...member, ...updates, accessUpdatedAt: new Date().toISOString() } : member)),
      };
      setMessage("Access profile updated.");
      return nextState;
    });
  }

  function removeAccess(memberId: string) {
    const targetMember = state.team.find((member) => member.id === memberId);
    if (targetMember && isProtectedAdmin(targetMember)) {
      setMessage("The built-in admin account cannot be removed.");
      return;
    }
    if (targetMember && isCurrentMember(targetMember, currentUser)) {
      setMessage("You cannot remove your own access while signed in.");
      return;
    }
    if (!targetMember) return;
    const removedKeys = accessMemberKeys(targetMember);
    setState((currentState) => {
      return {
        ...currentState,
        deletedTeamMemberKeys: Array.from(new Set([...(currentState.deletedTeamMemberKeys ?? []), ...removedKeys])),
        team: currentState.team.filter((member) => member.id !== memberId),
        leads: currentState.leads.map((lead) => ({
          ...lead,
          assignedTo: lead.assignedTo === memberId ? "admin" : lead.assignedTo,
          substituteAssignedTo: lead.substituteAssignedTo === memberId ? "" : lead.substituteAssignedTo,
        })),
      };
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
          <button disabled={creatingUser} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#003CBB] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#8aa8ee]">
            <UserPlus size={16} /> {creatingUser ? "Creating user..." : "Create user"}
          </button>
        </form>

        <section className="space-y-3">
          {state.team.map((member) => {
            const self = isCurrentMember(member, currentUser);
            const protectedAdmin = isProtectedAdmin(member);
            return (
            <article key={member.id} className="rounded-lg border border-[#dce3d5] bg-white p-4 shadow-sm">
              <div className="grid gap-4 xl:grid-cols-[280px_1fr_120px]">
                <div>
                  {self ? <p className="mb-2 inline-flex rounded-full bg-[#eef4ff] px-2.5 py-1 text-xs font-semibold text-[#003CBB]">Signed in now</p> : null}
                  <input
                    value={member.name}
                    onChange={(event) => updateMember(member.id, { name: event.target.value })}
                    readOnly={protectedAdmin}
                    className="w-full text-lg font-semibold outline-none"
                  />
                  <input
                    value={member.email ?? ""}
                    onChange={(event) => updateMember(member.id, { email: event.target.value })}
                    readOnly={protectedAdmin}
                    className="mt-1 w-full text-sm text-[#657267] outline-none"
                    placeholder="email"
                  />
                  <select value={member.role} onChange={(event) => updateMember(member.id, { role: event.target.value })} disabled={protectedAdmin} className="mt-3 h-9 w-full rounded-lg border border-[#d7dfd0] px-2 text-sm outline-none disabled:bg-[#f6f8fc]">
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
                      disabled={protectedAdmin || (self && module === "access" && member.modules.includes("access"))}
                      className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium ${
                        member.modules.includes(module) ? "border-[#12201b] bg-[#003CBB] text-white" : "border-[#d7dfd0] bg-white text-[#657267]"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      <ShieldCheck size={15} /> {moduleLabels[module]}
                    </button>
                  ))}
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => updateMember(member.id, { active: !member.active })}
                    disabled={protectedAdmin || (self && member.active)}
                    className="h-9 rounded-lg border border-[#d7dfd0] px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {member.active ? "Active" : "Inactive"}
                  </button>
                  <button disabled={protectedAdmin || self} onClick={() => removeAccess(member.id)} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-rose-600 px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-rose-300">
                    <Trash2 size={15} /> Remove
                  </button>
                </div>
              </div>
            </article>
          );
          })}
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

function existingMemberId(team: TeamMember[], email: string) {
  const normalized = email.trim().toLowerCase();
  return team.find((member) => member.email?.trim().toLowerCase() === normalized)?.id;
}

function isCurrentMember(member: TeamMember, user: User | null) {
  if (!user) return false;
  const memberEmail = member.email?.trim().toLowerCase();
  const userEmail = user.email?.trim().toLowerCase();
  return Boolean((member.uid && member.uid === user.uid) || (memberEmail && userEmail && memberEmail === userEmail));
}

function isProtectedAdmin(member: TeamMember) {
  return member.uid === "hardcoded-admin" || member.email?.trim().toLowerCase() === "admin@admin.com";
}

function accessMemberKeys(member: TeamMember) {
  return [member.email?.trim().toLowerCase(), member.uid, member.id].filter((key): key is string => Boolean(key));
}

function fallbackMemberId(email: string) {
  return `team-${email.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function safeFirebaseAppName(email: string) {
  return email.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "user";
}

function firebaseErrorCode(error: unknown) {
  return typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code) : "";
}

async function sendAccessCreatedEmail({
  resend,
  email,
  name,
  password,
  role,
  modules,
}: {
  resend: unknown;
  email: string;
  name: string;
  password?: string;
  role: string;
  modules: ModuleKey[];
}) {
  const loginUrl = typeof window === "undefined" ? "" : `${window.location.origin}/login`;
  const moduleList = modules.map((module) => moduleLabels[module]).join(", ");
  const passwordLine = password
    ? `Temporary password: ${password}`
    : "Use your existing password. If you cannot remember it, use Forgot password on the login page.";

  await fetch("/api/resend/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      resend,
      recipients: [{ email, name }],
      subject: "Your SavePlanet CRM access is ready",
      text: `Hi ${name || email},

Your SavePlanet CRM access has been created.

Login: ${loginUrl}
Email: ${email}
${passwordLine}
Role: ${role}
Modules: ${moduleList}

Please sign in and update your password if this is a temporary password.

SavePlanet CRM`,
      html: accessCreatedEmailHtml({ name, email, password, role, modules, loginUrl }),
    }),
  }).catch(() => undefined);
}

function accessCreatedEmailHtml({
  name,
  email,
  password,
  role,
  modules,
  loginUrl,
}: {
  name: string;
  email: string;
  password?: string;
  role: string;
  modules: ModuleKey[];
  loginUrl: string;
}) {
  const moduleBadges = modules.map((module) => `<span style="display:inline-block;margin:4px 6px 0 0;padding:7px 10px;border-radius:999px;background:#eef4ff;color:#003CBB;font-size:12px;font-weight:700;">${escapeHtml(moduleLabels[module])}</span>`).join("");
  const passwordBlock = password
    ? `<tr><td style="padding:10px 0;color:#657267;font-size:13px;">Temporary password</td><td style="padding:10px 0;color:#0f172a;font-size:14px;font-weight:700;">${escapeHtml(password)}</td></tr>`
    : `<tr><td colspan="2" style="padding:12px 0;color:#657267;font-size:13px;">Use your existing password. If needed, click Forgot password on the login page.</td></tr>`;

  return `<!doctype html>
<html>
  <body style="margin:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fb;padding:32px 12px;">
      <tr>
        <td align="center">
          <table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #d9e2f2;box-shadow:0 8px 28px rgba(15,23,42,0.08);">
            <tr>
              <td style="background:#003CBB;padding:28px 30px;color:#ffffff;">
                <img src="${savePlanetLogoUrl}" alt="SavePlanet" width="190" style="display:block;max-width:190px;height:auto;margin:0 0 18px;border:0;background:#ffffff;border-radius:10px;padding:10px 14px;" />
                <div style="font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#dbe7ff;">SavePlanet CRM</div>
                <h1 style="margin:10px 0 0;font-size:28px;line-height:1.2;">Your access is ready</h1>
                <p style="margin:10px 0 0;color:#dbe7ff;font-size:15px;">You can now sign in to your assigned CRM modules.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:30px;">
                <p style="margin:0 0 18px;font-size:16px;line-height:1.6;">Hi <strong>${escapeHtml(name || email)}</strong>, your SavePlanet CRM account has been created.</p>
                <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5edf7;border-bottom:1px solid #e5edf7;margin:18px 0;">
                  <tr><td style="padding:10px 0;color:#657267;font-size:13px;">Login email</td><td style="padding:10px 0;color:#0f172a;font-size:14px;font-weight:700;">${escapeHtml(email)}</td></tr>
                  ${passwordBlock}
                  <tr><td style="padding:10px 0;color:#657267;font-size:13px;">Role</td><td style="padding:10px 0;color:#0f172a;font-size:14px;font-weight:700;">${escapeHtml(role)}</td></tr>
                </table>
                <div style="margin:18px 0;">
                  <div style="font-size:13px;font-weight:700;color:#657267;text-transform:uppercase;letter-spacing:0.08em;">Enabled modules</div>
                  <div style="margin-top:8px;">${moduleBadges}</div>
                </div>
                <a href="${escapeHtml(loginUrl)}" style="display:inline-block;margin-top:18px;background:#003CBB;color:#ffffff;text-decoration:none;padding:13px 22px;border-radius:10px;font-weight:700;font-size:14px;">Open CRM Login</a>
                <p style="margin:22px 0 0;color:#657267;font-size:13px;line-height:1.6;">If this is a temporary password, sign in and change it as soon as possible.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
