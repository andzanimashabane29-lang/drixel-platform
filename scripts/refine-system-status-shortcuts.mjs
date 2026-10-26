import fs from 'node:fs'

const shellPath = 'src/components/admin/AdminShell.tsx'
let shell = fs.readFileSync(shellPath, 'utf8')

shell = shell.replace(
  "import { Building2, ChevronRight, CircleUserRound, KeyRound, Layers3, LayoutDashboard, LogIn, LogOut, Menu, Moon, Search, ScrollText, Settings, ShieldCheck, Sun, Users, X, type LucideIcon } from 'lucide-react'",
  "import { Building2, ChevronRight, CircleUserRound, KeyRound, Layers3, LayoutDashboard, LogIn, LogOut, Menu, Moon, Search, ScrollText, Settings, Sun, Users, X, type LucideIcon } from 'lucide-react'",
)

shell = shell.replace(
`    <div className="border-t border-border p-3">
      <button type="button" onClick={onSettings} className="flex w-full items-center gap-3 rounded-[var(--radius-control)] px-3 py-2.5 text-left hover:bg-surface-hover">
        <span className={cn('grid h-8 w-8 place-items-center rounded-full', oidcConfigured ? 'bg-success-bg text-success' : 'bg-warning-bg text-warning')}><ShieldCheck size={15} /></span>
        <span className="min-w-0"><strong className="block truncate text-[12px] font-medium text-foreground">{oidcConfigured ? 'Identity connected' : 'Identity setup needed'}</strong><small className="block truncate text-[11px] text-tertiary-foreground">Drixel ID</small></span>
      </button>
    </div>`,
`    <div className="border-t border-border px-4 py-3">
      <button type="button" onClick={onSettings} className="flex w-full items-center justify-between gap-3 rounded-[var(--radius-control)] px-2 py-2 text-left hover:bg-surface-hover">
        <span className="min-w-0"><strong className="block truncate text-[12px] font-medium text-foreground">Drixel ID</strong><small className="block truncate text-[11px] text-tertiary-foreground">Identity provider</small></span>
        <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground"><span className={cn('h-1.5 w-1.5 rounded-full', oidcConfigured ? 'bg-success' : 'bg-warning')} aria-hidden="true" />{oidcConfigured ? 'Connected' : 'Setup'}</span>
      </button>
    </div>`,
)

shell = shell.replace(
`  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setCommandOpen(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])`,
`  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const editing = Boolean(target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable))
      const key = event.key.toLowerCase()

      if ((event.metaKey || event.ctrlKey) && key === 'k') {
        event.preventDefault()
        setCommandOpen(true)
        return
      }

      if (event.key === 'Escape') {
        setCommandOpen(false)
        setMobileOpen(false)
        return
      }

      if (editing) return

      if (event.altKey && /^[1-7]$/.test(event.key)) {
        const index = Number(event.key) - 1
        const item = items[index]
        if (item) {
          event.preventDefault()
          item.onClick()
        }
        return
      }

      if (event.key === '/' && search) {
        event.preventDefault()
        const input = document.querySelector<HTMLInputElement>('[data-page-search]')
        input?.focus()
        input?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [items, search])`,
)

shell = shell.replace(
`<input value={search.value} onChange={(event) => search.onChange(event.target.value)} placeholder={search.placeholder} className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-tertiary-foreground" />`,
`<input data-page-search value={search.value} onChange={(event) => search.onChange(event.target.value)} placeholder={search.placeholder} className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-tertiary-foreground" />`,
)

shell = shell.replace(
`<div className="max-h-80 overflow-y-auto p-2">{commandItems.map(item => { const Icon = iconFor[item.label] ?? CircleUserRound; return <button key={item.label} type="button" onClick={() => { item.onClick(); setCommandOpen(false) }} className="flex h-11 w-full items-center gap-3 rounded-[var(--radius-control)] px-3 text-left text-[13px] text-foreground hover:bg-surface-hover"><Icon size={16} className="text-muted-foreground" />{item.label}</button> })}{commandItems.length === 0 && <div className="px-3 py-8 text-center text-[12px] text-muted-foreground">No matching section</div>}</div>`,
`<div className="max-h-80 overflow-y-auto p-2">{commandItems.map((item) => { const Icon = iconFor[item.label] ?? CircleUserRound; const shortcutIndex = items.findIndex((entry) => entry.label === item.label); return <button key={item.label} type="button" onClick={() => { item.onClick(); setCommandOpen(false) }} className="flex h-11 w-full items-center gap-3 rounded-[var(--radius-control)] px-3 text-left text-[13px] text-foreground hover:bg-surface-hover"><Icon size={16} className="text-muted-foreground" /><span className="flex-1">{item.label}</span>{shortcutIndex >= 0 && <kbd className="text-[10px] text-tertiary-foreground">Alt {shortcutIndex + 1}</kbd>}</button> })}{commandItems.length === 0 && <div className="px-3 py-8 text-center text-[12px] text-muted-foreground">No matching section</div>}</div><div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-4 py-2.5 text-[10px] text-tertiary-foreground"><span><kbd>Ctrl K</kbd> commands</span><span><kbd>Alt 1–7</kbd> navigate</span>{search && <span><kbd>/</kbd> search</span>}<span><kbd>Esc</kbd> close</span></div>`,
)

fs.writeFileSync(shellPath, shell)

const appPath = 'src/App.tsx'
let app = fs.readFileSync(appPath, 'utf8')
app = app.replace(
`            <div className="mb-4 flex items-center gap-2">
              <StatusPill status={error ? 'error' : loading ? 'muted' : allHealthy ? 'healthy' : 'warning'} label={error ? 'Directory unavailable' : loading ? 'Checking directory' : allHealthy ? 'All systems healthy' : 'Review required'} />
            </div>`,
`            <div className="mb-4 flex items-center gap-2 text-[12px] text-muted-foreground">
              <span className={\`h-1.5 w-1.5 rounded-full \${error ? 'bg-danger' : loading ? 'bg-tertiary-foreground' : allHealthy ? 'bg-success' : 'bg-warning'}\`} aria-hidden="true" />
              <span>{error ? 'Directory unavailable' : loading ? 'Checking directory' : allHealthy ? 'Directory healthy' : 'Directory needs review'}</span>
            </div>`,
)
fs.writeFileSync(appPath, app)
