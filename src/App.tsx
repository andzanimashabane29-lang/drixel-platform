import { useEffect, useMemo, useState, type ReactNode } from 'react'

type Section = 'Overview' | 'Businesses' | 'Services' | 'Accounts' | 'Access roles' | 'Audit log' | 'Settings'

type Business = { id: string; slug: string; name: string; kind: string; status: string }
type Service = { id: string; slug: string; name: string; status: string; owner_slug: string; owner_name: string; type: string }
type Portfolio = { businesses: Business[]; services: Service[] }
type BusinessRow = Business & { category: string; services: string }

const emptyPortfolio: Portfolio = { businesses: [], services: [] }

const statusLabel = (status: string) => status.charAt(0).toUpperCase() + status.slice(1)

const sections: Section[] = ['Overview', 'Businesses', 'Services', 'Accounts', 'Access roles', 'Audit log', 'Settings']

function App() {
  const [section, setSection] = useState<Section>('Overview')
  const [query, setQuery] = useState('')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [portfolio, setPortfolio] = useState<Portfolio>(emptyPortfolio)
  const [directoryLoading, setDirectoryLoading] = useState(true)
  const [directoryError, setDirectoryError] = useState(false)
  const [directoryRefresh, setDirectoryRefresh] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setDirectoryLoading(true)
    fetch('/api/portfolio', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Portfolio unavailable')
        return response.json() as Promise<Portfolio>
      })
      .then((data) => {
        setPortfolio({
          businesses: data.businesses ?? [],
          services: (data.services ?? []).map((service) => ({ ...service, type: 'Registered service' })),
        })
        setDirectoryError(false)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setDirectoryError(true)
      })
      .finally(() => {
        if (!controller.signal.aborted) setDirectoryLoading(false)
      })
    return () => controller.abort()
  }, [directoryRefresh])

  const businesses = useMemo<BusinessRow[]>(() => portfolio.businesses.map((business) => {
    const ownedServices = portfolio.services.filter((service) => service.owner_slug === business.slug).map((service) => service.name)
    return {
      ...business,
      category: business.kind === 'subsidiary' ? 'Subsidiary' : 'Business unit',
      services: ownedServices.length ? ownedServices.join(', ') : 'No services registered',
    }
  }), [portfolio])
  const services = portfolio.services
  const filteredBusinesses = useMemo(() => businesses.filter((business) =>
    `${business.name} ${business.category} ${business.services}`.toLowerCase().includes(query.toLowerCase()),
  ), [businesses, query])
  const filteredServices = useMemo(() => services.filter((service) =>
    `${service.name} ${service.owner_name} ${service.type}`.toLowerCase().includes(query.toLowerCase()),
  ), [services, query])
  const showSearch = section === 'Overview' || section === 'Businesses' || section === 'Services'

  const selectSection = (next: Section) => {
    setSection(next)
    setQuery('')
    setMobileNavOpen(false)
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-lockup" aria-label="Drixel Labs">
          <span className="brand-name">DRIXEL</span>
          <span className="brand-caption">LABS INC</span>
        </div>
        <div className="workspace-switcher">
          <span className="workspace-label">WORKSPACE</span>
          <strong>Drixel Labs Inc</strong>
          <span className="workspace-caret" aria-hidden="true">⌄</span>
        </div>
        <nav className="main-nav" aria-label="Main navigation">
          <span className="nav-label">GROUP ADMINISTRATION</span>
          {sections.map((item) => (
            <button
              key={item}
              className={`nav-item ${section === item ? 'nav-item-active' : ''}`}
              onClick={() => selectSection(item)}
              aria-current={section === item ? 'page' : undefined}
            >
              <span>{item}</span>
              {item === 'Accounts' && <span className="nav-count">—</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="connection-row"><span className="connection-dot" />Identity provider not connected</div>
          <div className="sidebar-version">Drixel Platform · Foundation</div>
        </div>
      </aside>

      {mobileNavOpen && <button className="nav-backdrop" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation" />}

      <div className="main-column">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileNavOpen(!mobileNavOpen)} aria-label="Toggle navigation">Menu</button>
          <div className="breadcrumb"><span>Drixel Labs Inc</span><span className="breadcrumb-divider">/</span><strong>{section}</strong></div>
          <div className="topbar-actions">
            {showSearch && <label className="search-field">
              <span className="search-label">Search</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={section === 'Businesses' ? 'businesses' : section === 'Services' ? 'services' : 'portfolio'} aria-label={`Search ${section.toLowerCase()}`} />
            </label>}
            <button className="user-control" aria-label="Account menu"><span className="user-initials">DL</span><span className="user-control-text">Group administrator</span></button>
          </div>
        </header>

        <main className="page-content">
          {section === 'Overview' && <Overview onNavigate={selectSection} onRetry={() => setDirectoryRefresh((value) => value + 1)} filteredBusinesses={filteredBusinesses} filteredServices={filteredServices} businessCount={businesses.length} serviceCount={services.length} loading={directoryLoading} error={directoryError} />}
          {section === 'Businesses' && <BusinessesPage rows={filteredBusinesses} loading={directoryLoading} error={directoryError} onRetry={() => setDirectoryRefresh((value) => value + 1)} />}
          {section === 'Services' && <ServicesPage rows={filteredServices} loading={directoryLoading} error={directoryError} onRetry={() => setDirectoryRefresh((value) => value + 1)} />}
          {section === 'Accounts' && <AccountsPage onNavigate={selectSection} />}
          {section === 'Access roles' && <RolesPage />}
          {section === 'Audit log' && <AuditPage />}
          {section === 'Settings' && <SettingsPage businessCount={businesses.length} serviceCount={services.length} directoryConnected={!directoryLoading && !directoryError} />}
        </main>
      </div>
    </div>
  )
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action && <div className="heading-action">{action}</div>}
    </div>
  )
}

function Overview({ onNavigate, onRetry, filteredBusinesses, filteredServices, businessCount, serviceCount, loading, error }: { onNavigate: (section: Section) => void; onRetry: () => void; filteredBusinesses: BusinessRow[]; filteredServices: Service[]; businessCount: number; serviceCount: number; loading: boolean; error: boolean }) {
  return (
    <>
      <PageHeading eyebrow="GROUP ADMINISTRATION" title="Overview" description="Manage Drixel businesses, services, and account access from one place." />
      <div className="status-banner">
        <div>
          <strong>{loading ? 'Loading the business directory' : error ? 'Business directory unavailable' : 'Business directory connected'}</strong>
          <p>{loading ? 'Reading business and service records from the Drixel directory.' : error ? 'The directory API could not be reached. Start the local API and database to view current records.' : 'Business and service records are loaded from PostgreSQL. Account sign-in still requires an identity provider.'}</p>
        </div>
        {error
          ? <button className="button button-secondary" onClick={onRetry}>Retry</button>
          : <button className="button button-secondary" onClick={() => onNavigate('Settings')}>View setup</button>}
      </div>

      <section className="metric-grid" aria-label="Portfolio summary">
        <Metric label="Businesses" value={loading || error ? '—' : String(businessCount)} detail="Under Drixel Labs Inc" />
        <Metric label="Registered services" value={loading || error ? '—' : String(serviceCount)} detail="Across the group portfolio" />
        <Metric label="Synced accounts" value="—" detail="Identity provider not connected" />
        <Metric label="Pending access changes" value="—" detail="Audit API not connected" />
      </section>

      <section className="content-panel">
        <div className="panel-heading">
          <div><h2>Business units</h2><p>Businesses registered under the Drixel Labs group.</p></div>
          <button className="text-button" onClick={() => onNavigate('Businesses')}>View all <span aria-hidden="true">→</span></button>
        </div>
        <BusinessTable rows={filteredBusinesses} compact />
      </section>

      <section className="content-panel service-panel">
        <div className="panel-heading">
          <div><h2>Services</h2><p>Products and services registered in the group directory.</p></div>
          <button className="text-button" onClick={() => onNavigate('Services')}>View all <span aria-hidden="true">→</span></button>
        </div>
        <div className="service-summary-list">
          {filteredServices.slice(0, 4).map((service) => <div className="service-summary-row" key={service.slug}><strong>{service.name}</strong><span>{service.owner_name}</span><span className="service-type">{service.type}</span></div>)}
          {filteredServices.length === 0 && <div className="empty-table">No services match this search.</div>}
        </div>
      </section>
      <footer className="page-footer">Drixel Labs Inc <span>·</span> Group directory</footer>
    </>
  )
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="metric-card"><span className="metric-label">{label}</span><strong className="metric-value">{value}</strong><span className="metric-detail">{detail}</span></div>
}

function DirectoryNotice({ loading, error, onRetry }: { loading: boolean; error: boolean; onRetry: () => void }) {
  if (!loading && !error) return null
  return <div className="status-banner" role="status"><div><strong>{loading ? 'Loading the group directory' : 'Group directory unavailable'}</strong><p>{loading ? 'Reading current business and service records.' : 'Start the local API and database, then retry to load current records.'}</p></div>{error && <button className="button button-secondary" onClick={onRetry}>Retry</button>}</div>
}

function BusinessesPage({ rows, loading, error, onRetry }: { rows: BusinessRow[]; loading: boolean; error: boolean; onRetry: () => void }) {
  return <><PageHeading eyebrow="PORTFOLIO" title="Businesses" description="The operating units connected to Drixel Labs Inc." action={<button className="button button-primary" disabled title="Business creation will be enabled when the management API is connected">Add business</button>} /><DirectoryNotice loading={loading} error={error} onRetry={onRetry} /><div className="content-panel"><div className="panel-heading"><div><h2>Registered businesses</h2><p>{rows.length} business units in the group directory.</p></div><span className="panel-meta">DIRECTORY</span></div><BusinessTable rows={rows} /></div><footer className="page-footer">Business records are loaded from the PostgreSQL group directory.</footer></>
}

function BusinessTable({ rows, compact = false }: { rows: BusinessRow[]; compact?: boolean }) {
  return (
    <div className={`table-scroll ${compact ? 'table-scroll-compact' : ''}`}>
      <table className="data-table"><thead><tr><th>BUSINESS</th><th>TYPE</th><th>SERVICES</th><th>STATUS</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.id}><td><strong className="table-primary">{row.name}</strong></td><td>{row.category}</td><td>{row.services}</td><td><span className="status-tag">{statusLabel(row.status)}</span></td></tr>)}
        {rows.length === 0 && <tr><td className="empty-table" colSpan={4}>No business units match this search.</td></tr>}</tbody>
      </table>
    </div>
  )
}

function ServicesPage({ rows, loading, error, onRetry }: { rows: Service[]; loading: boolean; error: boolean; onRetry: () => void }) {
  return <><PageHeading eyebrow="PORTFOLIO" title="Services" description="Products and services owned by Drixel businesses." action={<button className="button button-primary" disabled title="Service registration will be enabled when the management API is connected">Add service</button>} /><DirectoryNotice loading={loading} error={error} onRetry={onRetry} /><div className="content-panel"><div className="panel-heading"><div><h2>Registered services</h2><p>{rows.length} services in the group directory.</p></div><span className="panel-meta">DIRECTORY</span></div><div className="table-scroll"><table className="data-table"><thead><tr><th>SERVICE</th><th>OWNER</th><th>TYPE</th><th>STATUS</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong className="table-primary">{row.name}</strong></td><td>{row.owner_name}</td><td>{row.type}</td><td><span className="status-tag">{statusLabel(row.status)}</span></td></tr>)}{rows.length === 0 && <tr><td className="empty-table" colSpan={4}>No services are available for this view.</td></tr>}</tbody></table></div></div><footer className="page-footer">Each service has one owning business and its own data boundary.</footer></>
}

function AccountsPage({ onNavigate }: { onNavigate: (section: Section) => void }) {
  return <><PageHeading eyebrow="IDENTITY" title="Accounts" description="Review employee and user identities across Drixel services." action={<button className="button button-primary" disabled title="Invitations require identity-provider and API integration">Invite account</button>} /><div className="setup-panel"><div className="setup-index">01</div><div className="setup-copy"><span className="eyebrow">REQUIRED SETUP</span><h2>Connect Drixel ID to an identity provider</h2><p>Accounts are not loaded from a live identity provider yet. Once connected, this page will show verified identities, employee and customer memberships, and service access.</p><ul><li>One person can use a single sign-in across Drixel services.</li><li>Employee and customer access remain separate.</li><li>Each business only sees accounts and permissions in its own scope.</li></ul><div className="setup-actions"><button className="button button-primary" onClick={() => onNavigate('Settings')}>Open identity settings</button><span>Account data is not simulated.</span></div></div></div><div className="info-strip"><strong>Storage model</strong><span>Global account IDs with separate organization memberships and product roles.</span></div><footer className="page-footer">No accounts are displayed until a verified identity provider connection is configured.</footer></>
}

function RolesPage() {
  const roleRows = [
    ['Group owner', 'Group', 'Full group governance access'],
    ['Group administrator', 'Group', 'Manage group settings and business units'],
    ['Business administrator', 'Business', 'Manage one business unit'],
    ['Manager', 'Business', 'Manage assigned business operations'],
    ['Employee', 'Business', 'Standard employee access for one business'],
    ['Application administrator', 'Service', 'Manage one application'],
    ['Support agent', 'Service', 'Support users of one application'],
    ['End user', 'Service', 'Use the assigned application'],
    ['Workspace owner', 'Customer workspace', 'Manage one customer workspace'],
    ['Workspace member', 'Customer workspace', 'Use one customer workspace'],
  ]
  return <><PageHeading eyebrow="ACCESS CONTROL" title="Access roles" description="Permissions are assigned at a specific group, business, service, or customer workspace scope." /><div className="content-panel"><div className="panel-heading"><div><h2>Role catalogue</h2><p>Default roles created for scoped access control.</p></div><span className="panel-meta">10 ROLES</span></div><div className="table-scroll"><table className="data-table"><thead><tr><th>ROLE</th><th>SCOPE</th><th>PERMISSION SUMMARY</th></tr></thead><tbody>{roleRows.map(([name, scope, description]) => <tr key={name}><td><strong className="table-primary">{name}</strong></td><td><span className="scope-tag">{scope}</span></td><td>{description}</td></tr>)}</tbody></table></div></div><div className="plain-note"><strong>Access rule</strong><p>Membership in one business does not grant access to other Drixel businesses or their customer data.</p></div></>
}

function AuditPage() {
  return <><PageHeading eyebrow="GOVERNANCE" title="Audit log" description="Track important access and administration events across the group." /><div className="empty-state"><div className="empty-state-title">Audit events will appear here</div><p>The database is prepared for administrative audit events. Live events will be shown after the management API is connected.</p></div></>
}

function SettingsPage({ businessCount, serviceCount, directoryConnected }: { businessCount: number; serviceCount: number; directoryConnected: boolean }) {
  return <><PageHeading eyebrow="CONFIGURATION" title="Settings" description="Configure the shared identity and group directory services." /><section className="content-panel settings-section"><div className="panel-heading"><div><h2>Identity provider</h2><p>Single sign-on and account verification.</p></div><span className="status-tag status-tag-muted">Not connected</span></div><div className="settings-row"><div><strong>Provider</strong><span>Not selected</span></div><div><strong>Protocol</strong><span>OpenID Connect</span></div><div><strong>Multi-factor authentication</strong><span>Required for administrators</span></div><button className="button button-secondary" disabled title="Provider configuration is not implemented">Configure</button></div></section><section className="content-panel settings-section"><div className="panel-heading"><div><h2>Group directory</h2><p>Business and service registry in PostgreSQL.</p></div><span className={`status-tag ${directoryConnected ? '' : 'status-tag-muted'}`}>{directoryConnected ? 'Connected' : 'Unavailable'}</span></div><div className="settings-row"><div><strong>Parent organization</strong><span>Drixel Labs Inc</span></div><div><strong>Business units</strong><span>{directoryConnected ? `${businessCount} registered` : 'Unavailable'}</span></div><div><strong>Services</strong><span>{directoryConnected ? `${serviceCount} registered` : 'Unavailable'}</span></div></div></section><section className="content-panel settings-section"><div className="panel-heading"><div><h2>Security boundaries</h2><p>Current database controls.</p></div></div><ul className="security-list"><li>The portfolio API uses a dedicated read-only database role.</li><li>Row-level security hides customer workspaces from the portfolio API.</li><li>Account data remains unavailable until Drixel ID is connected.</li></ul></section><footer className="page-footer">Identity and account administration require an authenticated management API.</footer></>
}

export default App
