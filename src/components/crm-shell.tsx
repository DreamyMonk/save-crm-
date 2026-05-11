"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  FileText,
  KanbanSquare,
  LockKeyhole,
  Package,
  PencilRuler,
  ReceiptText,
  Settings2,
  Sparkles,
  UserCircle,
  UserPlus,
  Users,
} from "lucide-react";
import { AuthGate, SignOutButton } from "./auth-gate";
import { ModuleKey } from "@/lib/crm-data";
import { useCrmStore } from "@/lib/use-crm-store";

const navItems: { href: string; label: string; icon: typeof BarChart3; module: ModuleKey; matchHref?: string }[] = [
  { href: "/", label: "Dashboard", icon: BarChart3, module: "dashboard" },
  { href: "/leads", label: "Leads", icon: KanbanSquare, module: "leads" },
  { href: "/customers#all-customers", label: "All customer", icon: Users, module: "customers", matchHref: "/customers" },
  { href: "/customers#new-customer", label: "Add customer", icon: UserPlus, module: "customers", matchHref: "/customers" },
  { href: "/products", label: "Products", icon: Package, module: "products" },
  { href: "/quotes", label: "Quotes", icon: PencilRuler, module: "quotes" },
  { href: "/proposals", label: "Proposals", icon: FileText, module: "quotes" },
  { href: "/pipelines", label: "Pipelines", icon: Settings2, module: "pipelines" },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, module: "calendar" },
  { href: "/invoices", label: "Invoices", icon: ReceiptText, module: "invoices" },
  { href: "/access", label: "Access", icon: LockKeyhole, module: "access" },
  { href: "/settings", label: "Settings", icon: Settings2, module: "settings" },
  { href: "/reports", label: "Reports", icon: ClipboardList, module: "reports" },
];

const publicRoutePrefixes = ["/proposal", "/verify"] as const;

export function CrmShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (publicRoutePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return <>{children}</>;
  }

  return <AuthGate>{(user) => <ShellFrame email={user.email} uid={user.uid}>{children}</ShellFrame>}</AuthGate>;
}

function ShellFrame({ children, email, uid }: { children: React.ReactNode; email: string | null; uid: string }) {
  const pathname = usePathname();
  const { state, ready } = useCrmStore();
  const normalizedEmail = email?.trim().toLowerCase();
  const member = ready
    ? state.team.find((item) => item.active && normalizedEmail && item.email?.trim().toLowerCase() === normalizedEmail) ??
      state.team.find((item) => item.active && item.uid === uid)
    : undefined;
  const allowedModules = member ? member.modules : [];
  const visibleNav = navItems.filter((item) => allowedModules.includes(item.module));
  const activeModule = navItems.find((item) => {
    const matchHref = item.matchHref ?? item.href;
    return matchHref === "/" ? pathname === "/" : pathname.startsWith(matchHref);
  })?.module ?? "dashboard";
  const hasAccess = pathname === "/account" || allowedModules.includes(activeModule);

  return (
        <main className="min-h-screen bg-[#ffffff] text-[#0f172a]">
          <div className="flex min-h-screen">
            <aside className="hidden w-72 shrink-0 border-r border-white/10 bg-[#003CBB] text-white lg:block">
          <Link href="/" className="flex h-20 items-center gap-3 border-b border-white/10 px-6">
            <div className="relative grid size-11 place-items-center overflow-hidden rounded-lg bg-white text-[#003CBB]">
              {state.settings.logoUrl ? (
                <Image src={state.settings.logoUrl} alt="SavePlanet CRM logo" fill className="object-contain p-1" unoptimized />
              ) : (
                <Sparkles size={22} />
              )}
            </div>
            <div>
              <p className="text-lg font-semibold">SavePlanet CRM</p>
              <p className="text-sm text-white/55">Sales operations</p>
            </div>
          </Link>
          <nav className="space-y-2 px-4 py-5">
            {visibleNav.map((item) => {
              const Icon = item.icon;
              const matchHref = item.matchHref ?? item.href;
              const active = item.href.includes("#") ? false : matchHref === "/" ? pathname === "/" : pathname.startsWith(matchHref);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition ${
                    active ? "bg-white text-[#003CBB]" : "text-white/72 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mx-4 mt-6 rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-sm font-medium">Admin view</p>
            <p className="mt-1 text-xs leading-5 text-white/55">
              Pipeline ownership, access, notes, email and invoices are separated into real pages.
            </p>
          </div>
          <div className="mx-4 mt-4 space-y-3 rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="truncate text-xs text-white/55">{email}</p>
            <Link href="/account" className="inline-flex h-10 w-full items-center gap-2 rounded-lg border border-white/10 px-3 text-sm font-semibold text-white/72 hover:bg-white/10 hover:text-white">
              <UserCircle size={16} /> My account
            </Link>
            <SignOutButton />
          </div>
        </aside>
        <section className="min-w-0 flex-1">
          {!ready ? (
            <div className="grid min-h-screen place-items-center p-8">
              <div className="rounded-lg border border-[#dce3d5] bg-white p-6 text-center shadow-sm">
                <h1 className="text-xl font-semibold">Loading access</h1>
                <p className="mt-2 text-sm text-[#657267]">Checking your assigned modules.</p>
              </div>
            </div>
          ) : hasAccess ? children : (
            <div className="grid min-h-screen place-items-center p-8">
              <div className="rounded-lg border border-[#dce3d5] bg-white p-6 text-center shadow-sm">
                <h1 className="text-xl font-semibold">No module access</h1>
                <p className="mt-2 text-sm text-[#657267]">Ask an admin to enable this module in Access Manager.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export function PageHeader({
  eyebrow,
  title,
  actions,
}: {
  eyebrow: string;
  title: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-[#dfe7d7] bg-[#ffffff]/92 px-4 py-4 backdrop-blur md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#657267]">{eyebrow}</p>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function ButtonLink({
  href,
  children,
  variant = "dark",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "dark" | "light" | "lime";
}) {
  const className =
    variant === "lime"
      ? "bg-[#003CBB] text-white"
      : variant === "light"
        ? "border border-[#d7dfd0] bg-white text-[#0f172a]"
        : "bg-[#003CBB] text-white";

  return (
    <Link href={href} className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold shadow-sm ${className}`}>
      {children}
    </Link>
  );
}
