import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'
import { Check, ChevronRight, Copy, LoaderCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '../../lib/utils'

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <motion.header initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .2 }} className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-2 text-[12px] font-medium tracking-[.02em] text-muted-foreground">{eyebrow}</p>}
        <h1 className="text-[32px] font-semibold leading-[1.08] tracking-[-.02em] text-foreground md:text-[40px]">{title}</h1>
        {description && <p className="mt-3 max-w-2xl text-[14px] leading-6 text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </motion.header>
  )
}

export function Button({ className, variant = 'secondary', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  return <button className={cn('inline-flex h-9 items-center justify-center gap-2 rounded-[var(--radius-control)] px-3.5 text-[13px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent/30 disabled:pointer-events-none disabled:opacity-45 active:scale-[.985]', variant === 'primary' && 'bg-accent text-accent-foreground hover:brightness-[.97]', variant === 'secondary' && 'border border-border bg-surface text-foreground hover:bg-surface-hover', variant === 'ghost' && 'bg-transparent text-muted-foreground hover:bg-surface-hover hover:text-foreground', variant === 'danger' && 'bg-danger text-white hover:brightness-[.96]', className)} {...props} />
}

export function SectionCard({ children, className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn('overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface', className)} {...props}>{children}</section>
}

export function SectionHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="flex min-h-16 items-center justify-between gap-4 border-b border-border px-5 py-4"><div><h2 className="text-[16px] font-semibold tracking-[-.01em] text-foreground">{title}</h2>{description && <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>}</div>{action}</div>
}

export function StatusPill({ status, label }: { status: 'healthy' | 'active' | 'warning' | 'error' | 'muted'; label?: string }) {
  const classes = status === 'healthy' || status === 'active' ? 'bg-success-bg text-success' : status === 'warning' ? 'bg-warning-bg text-warning' : status === 'error' ? 'bg-danger-bg text-danger' : 'bg-surface-subtle text-muted-foreground'
  return <span className={cn('inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium', classes)}><span className="h-1.5 w-1.5 rounded-full bg-current" />{label ?? status}</span>
}

export function StatStrip({ items }: { items: Array<{ label: string; value: ReactNode; detail?: string }> }) {
  return <div className="grid overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface sm:grid-cols-2 lg:grid-cols-4">{items.map((item, index) => <div key={item.label} className={cn('min-h-28 px-5 py-4', index > 0 && 'border-t border-border sm:border-t-0 sm:border-l', index === 2 && 'sm:border-l-0 lg:border-l') }><p className="text-[12px] font-medium text-muted-foreground">{item.label}</p><div className="numeral mt-3 text-[28px] font-semibold tracking-[-.02em] text-foreground">{item.value}</div>{item.detail && <p className="mt-1 text-[12px] text-tertiary-foreground">{item.detail}</p>}</div>)}</div>
}

export function EmptyState({ title, description, action, icon }: { title: string; description: string; action?: ReactNode; icon?: ReactNode }) {
  return <div className="flex min-h-56 flex-col items-center justify-center px-6 py-10 text-center">{icon && <div className="mb-4 text-tertiary-foreground">{icon}</div>}<h3 className="text-[16px] font-semibold text-foreground">{title}</h3><p className="mt-2 max-w-md text-[13px] leading-5 text-muted-foreground">{description}</p>{action && <div className="mt-5">{action}</div>}</div>
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-surface-hover', className)} />
}

export function LoadingRow({ columns = 4 }: { columns?: number }) {
  return <div className="grid min-h-14 items-center gap-4 border-b border-border px-5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>{Array.from({ length: columns }).map((_, i) => <Skeleton key={i} className="h-4 w-3/4" />)}</div>
}

export function CopyField({ label, value }: { label: string; value: string }) {
  const copy = () => void navigator.clipboard?.writeText(value)
  return <div className="rounded-[var(--radius-control)] border border-border bg-surface-subtle p-3"><div className="mb-2 flex items-center justify-between gap-3"><span className="text-[12px] font-medium text-muted-foreground">{label}</span><button type="button" onClick={copy} className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium text-muted-foreground hover:bg-surface-hover hover:text-foreground"><Copy size={13} />Copy</button></div><code className="block overflow-x-auto whitespace-nowrap text-[12px] text-foreground">{value}</code></div>
}

export function TableRowLink({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center gap-1 font-medium text-foreground">{children}<ChevronRight size={14} className="text-tertiary-foreground" /></span>
}

export function SuccessMark() { return <Check size={15} aria-hidden="true" /> }
export function Spinner() { return <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> }
