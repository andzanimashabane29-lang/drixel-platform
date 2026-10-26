import { useEffect, useMemo, useState, type ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { AnimatePresence, motion } from 'framer-motion'
import { Building2, ChevronRight, CircleUserRound, KeyRound, Layers3, LayoutDashboard, LogIn, LogOut, Menu, Search, ScrollText, Settings, ShieldCheck, Users, X, type LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

export type AdminNavItem = { label: string; href: string; active?: boolean; onClick: () => void }

const iconFor: Record<string, LucideIcon> = {
  Overview: LayoutDashboard,
  Businesses: Building2,
  Services: Layers3,
  Accounts: Users,
  'Access roles': KeyRound,
  'Audit log': ScrollText,
  Settings,
}

function SidebarContent({ items, oidcConfigured, onSettings }: { items: AdminNavItem[]; oidcConfigured: boolean; onSettings: () => void }) {
  return <div className="flex h-full flex-col">
    <div className="flex h-16 items-center border-b border-border px-5"><span className="text-[15px] font-semibold tracking-[.16em] text-foreground">DRIXEL</span><span className="ml-2 text-[9px] font-medium tracking-[.1em] text-tertiary-foreground">LABS</span></div>
    <div className="px-3 py-4">
      <button type="button" className="w-full rounded-[var(--radius-card)] border border-border bg-surface/70 px-3.5 py-3 text-left backdrop-blur-xl hover:bg-surface">
        <span className="block text-[11px] font-medium text-muted-foreground">Workspace</span>
        <span className="mt-1 block text-[14px] font-semibold text-foreground">Drixel Labs Inc</span>
        <span className="mt-0.5 block text-[11px] text-tertiary-foreground">Group administration</span>
      </button>
    </div>
    <nav className="flex-1 space-y-1 px-3" aria-label="Group administration">
      {items.map((item) => {
        const Icon = iconFor[item.label] ?? LayoutDashboard
        return <a key={item.label} href={item.href} onClick={(event) => { event.preventDefault(); item.onClick() }} aria-current={item.active ? 'page' : undefined} className={cn('flex h-10 items-center gap-3 rounded-[var(--radius-control)] px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground', item.active && 'bg-[var(--sidebar-active)] text-accent')}><Icon size={17} strokeWidth={1.8} aria-hidden="true" /><span>{item.label}</span></a>
      })}
    </nav>
    <div className="border-t border-border p-3">
      <button type="button" onClick={onSettings} className="flex w-full items-center gap-3 rounded-[var(--radius-control)] px-3 py-2.5 text-left hover:bg-surface-hover">
        <span className={cn('grid h-8 w-8 place-items-center rounded-full', oidcConfigured ? 'bg-success-bg text-success' : 'bg-warning-bg text-warning')}><ShieldCheck size={15} /></span>
        <span className="min-w-0"><strong className="block truncate text-[12px] font-medium text-foreground">{oidcConfigured ? 'Identity connected' : 'Identity setup needed'}</strong><small className="block truncate text-[11px] text-tertiary-foreground">Drixel ID</small></span>
      </button>
    </div>
  </div>
}

export function AdminShell({ items, breadcrumbs, search, authenticated, oidcConfigured, onSignIn, onSignOut, onSettings, children }: { items: AdminNavItem[]; breadcrumbs: Array<{ label: string; onClick?: () => void }>; search?: { value: string; placeholder: string; onChange: (value: string) => void }; authenticated: boolean; oidcConfigured: boolean; onSignIn: () => void; onSignOut: () => void; onSettings: () => void; children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const commandItems = useMemo(() => items, [items])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setCommandOpen(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return <div className="min-h-screen bg-background text-foreground">
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] border-r border-border bg-[var(--sidebar)] backdrop-blur-2xl md:block"><SidebarContent items={items} oidcConfigured={oidcConfigured} onSettings={onSettings} /></aside>

    <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
      <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-black/25 backdrop-blur-[2px] md:hidden" /><Dialog.Content className="fixed inset-y-0 left-0 z-[51] w-[min(320px,86vw)] border-r border-border bg-background shadow-[var(--floating-shadow)] md:hidden"><SidebarContent items={items.map(item => ({...item, onClick: () => { item.onClick(); setMobileOpen(false) }}))} oidcConfigured={oidcConfigured} onSettings={() => { onSettings(); setMobileOpen(false) }} /><Dialog.Close className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-surface text-muted-foreground hover:text-foreground" aria-label="Close navigation"><X size={16} /></Dialog.Close></Dialog.Content></Dialog.Portal>
    </Dialog.Root>

    <div className="min-h-screen md:pl-[248px]">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-2xl md:px-8">
        <button type="button" onClick={() => setMobileOpen(true)} className="grid h-9 w-9 place-items-center rounded-[var(--radius-control)] hover:bg-surface-hover md:hidden" aria-label="Open navigation"><Menu size={18} /></button>
        <nav className="flex min-w-0 flex-1 items-center gap-1.5" aria-label="Breadcrumbs">{breadcrumbs.map((crumb, index) => <span key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1.5">{index > 0 && <ChevronRight size={13} className="shrink-0 text-tertiary-foreground" />}{crumb.onClick ? <button type="button" onClick={crumb.onClick} className="truncate text-[12px] text-muted-foreground hover:text-foreground">{crumb.label}</button> : <span className="truncate text-[12px] font-medium text-foreground">{crumb.label}</span>}</span>)}</nav>
        <button type="button" onClick={() => setCommandOpen(true)} className="hidden h-9 min-w-56 items-center gap-2 rounded-[var(--radius-control)] border border-border bg-surface/80 px-3 text-left text-[12px] text-muted-foreground shadow-none hover:bg-surface md:flex"><Search size={14} /><span className="flex-1">Search or jump to…</span><kbd className="rounded border border-border bg-surface-subtle px-1.5 py-0.5 text-[10px] text-tertiary-foreground">Ctrl K</kbd></button>
        {search && <label className="hidden h-9 w-52 items-center gap-2 rounded-[var(--radius-control)] border border-border bg-surface px-3 lg:flex"><Search size={14} className="text-tertiary-foreground" /><span className="sr-only">Search</span><input value={search.value} onChange={(event) => search.onChange(event.target.value)} placeholder={search.placeholder} className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-tertiary-foreground" /></label>}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild><button type="button" className="grid h-9 w-9 place-items-center rounded-full bg-foreground text-[11px] font-semibold text-background ring-offset-2 hover:opacity-90" aria-label="Account menu">{authenticated ? 'ID' : 'DL'}</button></DropdownMenu.Trigger>
          <DropdownMenu.Portal><DropdownMenu.Content sideOffset={10} align="end" className="z-50 min-w-56 rounded-[var(--radius-card)] border border-border bg-surface p-1.5 shadow-[var(--floating-shadow)]"><div className="px-2.5 py-2"><p className="text-[12px] font-medium text-foreground">{authenticated ? 'Drixel ID' : 'Drixel Labs'}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{authenticated ? 'Secure session active' : 'Not signed in'}</p></div><DropdownMenu.Separator className="my-1 h-px bg-border" /><DropdownMenu.Item onSelect={onSettings} className="flex h-9 cursor-pointer items-center gap-2 rounded-md px-2.5 text-[12px] text-foreground outline-none hover:bg-surface-hover focus:bg-surface-hover"><Settings size={15} />Settings</DropdownMenu.Item><DropdownMenu.Item onSelect={authenticated ? onSignOut : onSignIn} className="flex h-9 cursor-pointer items-center gap-2 rounded-md px-2.5 text-[12px] text-foreground outline-none hover:bg-surface-hover focus:bg-surface-hover">{authenticated ? <LogOut size={15} /> : <LogIn size={15} />}{authenticated ? 'Sign out' : 'Sign in'}</DropdownMenu.Item></DropdownMenu.Content></DropdownMenu.Portal>
        </DropdownMenu.Root>
      </header>
      <main className="mx-auto w-full max-w-[1440px] px-4 py-8 md:px-10 md:py-10">{children}</main>
    </div>

    <Dialog.Root open={commandOpen} onOpenChange={setCommandOpen}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-[3px]" /><Dialog.Content className="fixed left-1/2 top-[18%] z-[61] w-[min(560px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-[16px] border border-border bg-surface shadow-[var(--floating-shadow)]"><Dialog.Title className="sr-only">Command palette</Dialog.Title><div className="flex h-12 items-center gap-2 border-b border-border px-4"><Search size={16} className="text-tertiary-foreground" /><span className="text-[13px] text-muted-foreground">Jump to a section</span></div><div className="p-2">{commandItems.map(item => { const Icon = iconFor[item.label] ?? CircleUserRound; return <button key={item.label} type="button" onClick={() => { item.onClick(); setCommandOpen(false) }} className="flex h-11 w-full items-center gap-3 rounded-[var(--radius-control)] px-3 text-left text-[13px] text-foreground hover:bg-surface-hover"><Icon size={16} className="text-muted-foreground" />{item.label}</button> })}</div></Dialog.Content></Dialog.Portal></Dialog.Root>
  </div>
}
