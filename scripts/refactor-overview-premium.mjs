import fs from 'node:fs'

const path = 'src/App.tsx'
let text = fs.readFileSync(path, 'utf8')

text = text.replace(
  `import { PageHeader } from './components/admin/ui'`,
  `import { Button, EmptyState, PageHeader, SectionCard, SectionHeader, StatStrip, StatusPill, TableRowLink } from './components/admin/ui'`,
)

const start = text.indexOf('function Overview(')
const end = text.indexOf('\nfunction Metric(', start)
if (start < 0 || end < 0) throw new Error('Overview block not found')

const replacement = `function Overview({ onNavigate, onOpenBusiness, onOpenService, onRetry, filteredBusinesses, filteredServices, businessCount, activeBusinessCount, serviceCount, activeServiceCount, loading, error }: { onNavigate: (section: Section) => void; onOpenBusiness: (slug: string) => void; onOpenService: (slug: string) => void; onRetry: () => void; filteredBusinesses: BusinessRow[]; filteredServices: Service[]; businessCount: number; activeBusinessCount: number; serviceCount: number; activeServiceCount: number; loading: boolean; error: boolean }) {
  const totalValue = (count: number) => loading ? '—' : error ? 'Unavailable' : String(count)
  const allHealthy = !loading && !error && activeBusinessCount === businessCount && activeServiceCount === serviceCount

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Group administration"
        title="Drixel Labs Inc"
        description="Manage the businesses, services and access that make up the Drixel group."
        action={<Button variant="secondary" onClick={onRetry}>{error ? 'Retry directory' : 'Refresh directory'}</Button>}
      />

      <section className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
        <div className="flex flex-col gap-6 px-6 py-7 md:flex-row md:items-end md:justify-between md:px-8 md:py-8">
          <div className="max-w-2xl">
            <div className="mb-4 flex items-center gap-2">
              <StatusPill status={error ? 'error' : loading ? 'muted' : allHealthy ? 'healthy' : 'warning'} label={error ? 'Directory unavailable' : loading ? 'Checking directory' : allHealthy ? 'All systems healthy' : 'Review required'} />
            </div>
            <h2 className="text-[28px] font-semibold tracking-[-.02em] text-foreground md:text-[32px]">{loading ? 'Reading your group directory' : error ? 'The group directory needs attention' : `${businessCount} businesses, ${serviceCount} services`}</h2>
            <p className="mt-3 max-w-xl text-[14px] leading-6 text-muted-foreground">{loading ? 'Current business and service records are being loaded.' : error ? 'Drixel could not read the current directory. Retry the connection or review directory settings.' : 'Your operating portfolio is connected and available from one administration workspace.'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => onNavigate('Businesses')}>View businesses</Button>
            <Button variant="primary" onClick={() => onNavigate('Services')}>View services</Button>
          </div>
        </div>
        <div className="border-t border-border">
          <StatStrip items={[
            { label: 'Businesses', value: totalValue(businessCount), detail: 'Registered group units' },
            { label: 'Active businesses', value: totalValue(activeBusinessCount), detail: 'Currently operating' },
            { label: 'Services', value: totalValue(serviceCount), detail: 'Products and shared services' },
            { label: 'Active services', value: totalValue(activeServiceCount), detail: 'Currently available' },
          ]} />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
        <SectionCard>
          <SectionHeader title="Businesses" description="Operating units registered under Drixel Labs Inc." action={<Button variant="ghost" onClick={() => onNavigate('Businesses')}>View all</Button>} />
          {filteredBusinesses.length ? <div className="divide-y divide-border">
            {filteredBusinesses.slice(0, 6).map((business) => (
              <button key={business.id} type="button" onClick={() => onOpenBusiness(business.slug)} className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 text-left hover:bg-surface-hover focus-visible:bg-surface-hover md:grid-cols-[minmax(0,1.2fr)_minmax(140px,.6fr)_auto]">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-subtle text-[12px] font-semibold text-muted-foreground">{business.name.slice(0, 1).toUpperCase()}</span>
                  <span className="min-w-0"><span className="block truncate text-[14px] font-medium text-foreground"><TableRowLink>{business.name}</TableRowLink></span><span className="mt-0.5 block truncate text-[12px] text-tertiary-foreground">{business.services}</span></span>
                </span>
                <span className="hidden text-[12px] text-muted-foreground md:block">{business.category}</span>
                <StatusPill status={business.status === 'active' ? 'active' : business.status === 'suspended' ? 'warning' : 'muted'} label={statusLabel(business.status)} />
              </button>
            ))}
          </div> : <EmptyState title={error ? 'Businesses are unavailable' : 'No businesses found'} description={error ? 'Retry the directory connection to load businesses.' : 'No businesses match the current search.'} action={error ? <Button variant="secondary" onClick={onRetry}>Retry</Button> : undefined} />}
        </SectionCard>

        <SectionCard>
          <SectionHeader title="Services" description="Products and shared group services." action={<Button variant="ghost" onClick={() => onNavigate('Services')}>View all</Button>} />
          {filteredServices.length ? <div className="divide-y divide-border">
            {filteredServices.slice(0, 6).map((service) => (
              <button key={service.id} type="button" onClick={() => onOpenService(service.slug)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-surface-hover focus-visible:bg-surface-hover">
                <span className="min-w-0"><span className="block truncate text-[14px] font-medium text-foreground">{service.name}</span><span className="mt-0.5 block truncate text-[12px] text-tertiary-foreground">{service.owner_name}</span></span>
                <StatusPill status={service.status === 'active' ? 'active' : service.status === 'suspended' ? 'warning' : 'muted'} label={statusLabel(service.status)} />
              </button>
            ))}
          </div> : <EmptyState title={error ? 'Services are unavailable' : 'No services found'} description={error ? 'Retry the directory connection to load services.' : 'No services match the current search.'} action={error ? <Button variant="secondary" onClick={onRetry}>Retry</Button> : undefined} />}
        </SectionCard>
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-6 text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>Portfolio changes are restricted to authorized group administrators.</span>
        <Button variant="ghost" onClick={() => onNavigate('Settings')}>Review group settings</Button>
      </div>
    </div>
  )
}
`

text = text.slice(0, start) + replacement + text.slice(end)
fs.writeFileSync(path, text)
