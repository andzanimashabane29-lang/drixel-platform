import { useMemo, useState, type ReactNode } from 'react'

type Section = 'Overview' | 'Businesses' | 'Services' | 'Accounts' | 'Access roles' | 'Audit log' | 'Settings'

const businesses = [
  { name: 'Drixel SA', category: 'Fashion and ecommerce', services: 'Drixel SA Store', status: 'Registered' },
  { name: 'Excel Tutoring Academy SA', category: 'Online education', services: 'Learning Platform', status: 'Registered' },
  { name: 'DrixelOne', category: 'Technology', services: 'No services registered', status: 'Registered' },
  { name: 'Drixel Digital Products', category: 'Digital products', services: 'A-Chatz, SkrpTure', status: 'Registered' },
]

const services = [
  { name: 'Drixel ID', owner: 'Drixel Labs Inc', type: 'Identity service' },
  { name: 'Drixel SA Store', owner: 'Drixel SA', type: 'Commerce' },
  { name: 'Excel Tutoring Academy Learning Platform', owner: 'Excel Tutoring Academy SA', type: 'Education' },
  { name: 'A-Chatz', owner: 'Drixel Digital Products', type: 'Messaging' },
  { name: 'SkrpTure', owner: 'Drixel Digital Products', type: 'Church presentation' },
]

const sections: Section[] = ['Overview', 'Businesses', 'Services', 'Accounts', 'Access roles', 'Audit log', 'Settings']

function App() {
  const [section, setSection] = useState<Section>('Overview')
  const [query, setQuery] = useState('')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const filteredBusinesses = useMemo(() => businesses.filter((business) =>
    `${business.name} ${business.category} ${business.services}`.toLowerCase().includes(query.toLowerCase()),
  ), [query])
  const filteredServices = useMemo(() => services.filter((service) =>
    `${service.name} ${service.owner} ${service.type}`.toLowerCase().includes(query.toLowerCase()),
  ), [query])
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
          {section === 'Overview' && <Overview onNavigate={selectSection} filteredBusinesses={filteredBusinesses} filteredServices={filteredServices} />}
          {section === 'Businesses' && <BusinessesPage rows={filteredBusinesses} />}
          {section === 'Services' && <ServicesPage rows={filteredServices} />}
          {section === 'Accounts' && <AccountsPage onNavigate={selectSection} />}
          {section === 'Access roles' && <RolesPage />}
          {section === 'Audit log' && <AuditPage />}
          {section === 'Settings' && <SettingsPage />}
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

function Overview({ onNavigate, filteredBusinesses, filteredServices }: { onNavigate: (section: Section) => void; filteredBusinesses: typeof businesses; filteredServices: typeof services }) {
  return (
    <>
      <PageHeading eyebrow="GROUP ADMINISTRATION" title="Overview" description="Manage Drixel businesses, services, and account access from one place." />
      <div className="status-banner">
        <div>
          <strong>Account sign-in is not connected yet</strong>
          <p>The business directory is ready. Connect an identity provider and API to load and manage real accounts.</p>
        </div>
        <button className="button button-secondary" onClick={() => onNavigate('Settings')}>View setup</button>
      </div>

      <section className="metric-grid" aria-label="Portfolio summary">
        <Metric label="Business units" value="4" detail="Under Drixel Labs Inc" />
        <Metric label="Registered services" value="5" detail="Group and 3 business units" />
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
          {filteredServices.slice(0, 4).map((service) => <div className="service-summary-row" key={service.name}><strong>{service.name}</strong><span>{service.owner}</span><span className="service-type">{service.type}</span></div>)}
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

function BusinessesPage({ rows }: { rows: typeof businesses }) {
  return <><PageHeading eyebrow="PORTFOLIO" title="Businesses" description="The operating units connected to Drixel Labs Inc." action={<button className="button button-primary" disabled title="Business creation will be enabled when the API is connected">Add business</button>} /><div className="content-panel"><div className="panel-heading"><div><h2>Registered businesses</h2><p>{rows.length} business units in the group directory.</p></div><span className="panel-meta">DIRECTORY</span></div><BusinessTable rows={rows} /></div><footer className="page-footer">Business registration is stored in the PostgreSQL portfolio seed.</footer></>
}

function BusinessTable({ rows, compact = false }: { rows: typeof businesses; compact?: boolean }) {
  return (
    <div className={`table-scroll ${compact ? 'table-scroll-compact' : ''}`}>
      <table className="data-table"><thead><tr><th>BUSINESS</th><th>SECTOR</th><th>SERVICES</th><th>STATUS</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.name}><td><strong className="table-primary">{row.name}</strong></td><td>{row.category}</td><td>{row.services}</td><td><span className="status-tag">{row.status}</span></td></tr>)}
        {rows.length === 0 && <tr><td className="empty-table" colSpan={4}>No business units match this search.</td></tr>}</tbody>
      </table>
    </div>
  )
}

function ServicesPage({ rows }: { rows: typeof services }) {
  return <><PageHeading eyebrow="PORTFOLIO" title="Services" description="Products and services owned by Drixel businesses." action={<button className="button button-primary" disabled title="Service registration will be enabled when the API is connected">Add service</button>} /><div className="content-panel"><div className="panel-heading"><div><h2>Registered services</h2><p>{rows.length} services in the group directory.</p></div><span className="panel-meta">DIRECTORY</span></div><div className="table-scroll"><table className="data-table"><thead><tr><th>SERVICE</th><th>OWNER</th><th>CATEGORY</th><th>STATUS</th></tr></thead><tbody>{rows.map((row) => <tr key={row.name}><td><strong className="table-primary">{row.name}</strong></td><td>{row.owner}</td><td>{row.type}</td><td><span className="status-tag">Registered</span></td></tr>)}{rows.length === 0 && <tr><td className="empty-table" colSpan={4}>No services match this search.</td></tr>}</tbody></table></div></div><footer className="page-footer">Each service has one owning business and its own data boundary.</footer></>
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

function SettingsPage() {
  return <><PageHeading eyebrow="CONFIGURATION" title="Settings" description="Configure the shared identity and group directory services." /><section className="content-panel settings-section"><div className="panel-heading"><div><h2>Identity provider</h2><p>Single sign-on and account verification.</p></div><span className="status-tag status-tag-muted">Not connected</span></div><div className="settings-row"><div><strong>Provider</strong><span>Not selected</span></div><div><strong>Protocol</strong><span>OpenID Connect</span></div><div><strong>Multi-factor authentication</strong><span>Required for administrators</span></div><button className="button button-secondary" disabled title="Provider configuration is not implemented">Configure</button></div></section><section className="content-panel settings-section"><div className="panel-heading"><div><h2>Group directory</h2><p>Business and service registry in PostgreSQL.</p></div><span className="status-tag">Seeded</span></div><div className="settings-row"><div><strong>Parent organization</strong><span>Drixel Labs Inc</span></div><div><strong>Business units</strong><span>4 registered</span></div><div><strong>Services</strong><span>5 registered</span></div></div></section><section className="content-panel settings-section"><div className="panel-heading"><div><h2>Security boundaries</h2><p>Current database controls.</p></div></div><ul className="security-list"><li>Account credentials remain with the identity provider.</li><li>Database row-level security is enabled for private group data.</li><li>Service access is designed to use scoped membership and roles.</li></ul></section><footer className="page-footer">Configuration changes will be available after the identity and management API are connected.</footer></>
}

export default App
