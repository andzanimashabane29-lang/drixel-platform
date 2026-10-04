import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'

type Section = 'Overview' | 'Businesses' | 'Services' | 'Accounts' | 'Access roles' | 'Audit log' | 'Settings'

type Business = { id: string; slug: string; name: string; kind: string; status: string }
type Service = { id: string; slug: string; name: string; status: string; owner_slug: string; owner_name: string }
type Portfolio = { businesses: Business[]; services: Service[] }
type BusinessRow = Business & { category: string; services: string }
type AppRoute = { section: Section; slug?: string }

const emptyPortfolio: Portfolio = { businesses: [], services: [] }

const statusLabel = (status: string) => status.charAt(0).toUpperCase() + status.slice(1)

const sections: Section[] = ['Overview', 'Businesses', 'Services', 'Accounts', 'Access roles', 'Audit log', 'Settings']
const sectionPaths: Record<Section, string> = {
  Overview: '/overview',
  Businesses: '/businesses',
  Services: '/services',
  Accounts: '/accounts',
  'Access roles': '/access-roles',
  'Audit log': '/audit-log',
  Settings: '/settings',
}

function routeFromPath(pathname: string): AppRoute {
  const section = sections.find((candidate) => sectionPaths[candidate] === pathname)
  if (section) return { section }

  const recordMatch = pathname.match(/^\/(businesses|services)\/([a-z0-9]+(?:-[a-z0-9]+)*)$/)
  if (recordMatch) return { section: recordMatch[1] === 'businesses' ? 'Businesses' : 'Services', slug: recordMatch[2] }
  return { section: 'Overview' }
}

function followSectionLink(event: ReactMouseEvent<HTMLAnchorElement>, navigate: () => void) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  navigate()
}

function App() {
  const [route, setRoute] = useState<AppRoute>(() => routeFromPath(window.location.pathname))
  const section = route.section
  const [query, setQuery] = useState('')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
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
          services: data.services ?? [],
        })
        setDirectoryError(false)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setPortfolio(emptyPortfolio)
        setDirectoryError(true)
      })
      .finally(() => {
        if (!controller.signal.aborted) setDirectoryLoading(false)
      })
    return () => controller.abort()
  }, [directoryRefresh])

  useEffect(() => {
    const initialRoute = routeFromPath(window.location.pathname)
    const knownPath = sections.some((knownSection) => sectionPaths[knownSection] === window.location.pathname)
      || Boolean(initialRoute.slug)
    if (!knownPath) window.history.replaceState(null, '', sectionPaths.Overview)
    const handlePopState = () => {
      setRoute(routeFromPath(window.location.pathname))
      setQuery('')
      setMobileNavOpen(false)
      setAccountMenuOpen(false)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileNavOpen(false)
        setAccountMenuOpen(false)
      }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])

  const businesses = useMemo<BusinessRow[]>(() => portfolio.businesses.map((business) => {
    const ownedServices = portfolio.services.filter((service) => service.owner_slug === business.slug).map((service) => service.name)
    return {
      ...business,
      category: business.kind === 'subsidiary' ? 'Subsidiary' : 'Business unit',
      services: ownedServices.length ? ownedServices.join(', ') : 'No services registered',
    }
  }), [portfolio])
  const services = portfolio.services
  const selectedBusiness = route.section === 'Businesses' ? businesses.find((business) => business.slug === route.slug) : undefined
  const selectedService = route.section === 'Services' ? services.find((service) => service.slug === route.slug) : undefined
  useEffect(() => {
    const recordName = selectedBusiness?.name ?? selectedService?.name
    document.title = `${recordName ?? section} | Drixel Labs Inc`
  }, [section, selectedBusiness?.name, selectedService?.name])
  const activeBusinessCount = businesses.filter((business) => business.status === 'active').length
  const activeServiceCount = services.filter((service) => service.status === 'active').length
  const filteredBusinesses = useMemo(() => businesses.filter((business) =>
    `${business.name} ${business.category} ${business.services}`.toLowerCase().includes(query.toLowerCase()),
  ), [businesses, query])
  const filteredServices = useMemo(() => services.filter((service) =>
    `${service.name} ${service.owner_name}`.toLowerCase().includes(query.toLowerCase()),
  ), [services, query])
  const showSearch = !route.slug && (section === 'Overview' || section === 'Businesses' || section === 'Services')

  const navigateTo = (path: string, nextRoute: AppRoute) => {
    window.history.pushState(null, '', path)
    setRoute(nextRoute)
    setQuery('')
    setMobileNavOpen(false)
    setAccountMenuOpen(false)
  }

  const selectSection = (next: Section) => navigateTo(sectionPaths[next], { section: next })
  const openBusiness = (slug: string) => navigateTo(`/businesses/${encodeURIComponent(slug)}`, { section: 'Businesses', slug })
  const openService = (slug: string) => navigateTo(`/services/${encodeURIComponent(slug)}`, { section: 'Services', slug })

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-lockup" aria-label="Drixel Labs">
          <span className="brand-name">DRIXEL</span>
          <span className="brand-caption">LABS INC</span>
        </div>
        <div className="workspace-switcher" aria-label="Current workspace">
          <span className="workspace-label">WORKSPACE</span>
          <strong>Drixel Labs Inc</strong>
          <span className="workspace-context">Group administration</span>
        </div>
        <nav id="group-navigation" className="main-nav" aria-label="Main navigation">
          <span className="nav-label">GROUP ADMINISTRATION</span>
          {sections.map((item) => (
            <a
              key={item}
              href={sectionPaths[item]}
              className={`nav-item ${section === item ? 'nav-item-active' : ''}`}
              onClick={(event) => followSectionLink(event, () => selectSection(item))}
              aria-current={section === item ? 'page' : undefined}
              aria-label={`Open ${item} page`}
            >
              <span>{item}</span>
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="connection-row" onClick={() => selectSection('Settings')}><span className="connection-dot" />Identity provider not connected</button>
          <div className="sidebar-version">Drixel Platform · Foundation</div>
        </div>
      </aside>

      {mobileNavOpen && <button className="nav-backdrop" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation" />}

      <div className="main-column">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileNavOpen(!mobileNavOpen)} aria-expanded={mobileNavOpen} aria-controls="group-navigation">Menu</button>
          <div className="breadcrumb"><a href={sectionPaths.Overview} onClick={(event) => followSectionLink(event, () => selectSection('Overview'))}>Drixel Labs Inc</a><span className="breadcrumb-divider">/</span>{route.slug ? <><a href={sectionPaths[section]} onClick={(event) => followSectionLink(event, () => selectSection(section))}>{section}</a><span className="breadcrumb-divider">/</span><strong>{selectedBusiness?.name ?? selectedService?.name ?? route.slug}</strong></> : <strong>{section}</strong>}</div>
          <div className="topbar-actions">
            {showSearch && <div className="search-field">
              <label className="search-label" htmlFor="portfolio-search">Search</label>
              <input id="portfolio-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={section === 'Businesses' ? 'businesses' : section === 'Services' ? 'services' : 'portfolio'} />
              {query && <button type="button" className="search-clear" onClick={() => setQuery('')} aria-label="Clear search">Clear</button>}
            </div>}
            <div className="account-menu-wrap">
              <button className="user-control" aria-label="Identity status" aria-expanded={accountMenuOpen} aria-controls="identity-status-panel" onClick={() => setAccountMenuOpen((open) => !open)}>
                <span className="user-initials">DL</span><span className="user-control-text">Not signed in</span>
              </button>
              {accountMenuOpen && <div id="identity-status-panel" className="account-popover" role="region" aria-label="Identity connection status">
                <strong>Drixel ID</strong>
                <span>Single sign-on is not configured.</span>
                <span className="account-popover-status">This console currently reads the business directory only.</span>
                <a className="text-button" href={sectionPaths.Settings} onClick={(event) => followSectionLink(event, () => selectSection('Settings'))}>Identity settings <span aria-hidden="true">→</span></a>
              </div>}
            </div>
          </div>
        </header>

        <main className="page-content">
          {section === 'Overview' && <Overview onNavigate={selectSection} onOpenBusiness={openBusiness} onOpenService={openService} onRetry={() => setDirectoryRefresh((value) => value + 1)} filteredBusinesses={filteredBusinesses} filteredServices={filteredServices} businessCount={businesses.length} activeBusinessCount={activeBusinessCount} serviceCount={services.length} activeServiceCount={activeServiceCount} loading={directoryLoading} error={directoryError} />}
          {section === 'Businesses' && (route.slug
            ? <BusinessDetailPage business={selectedBusiness} services={services.filter((service) => service.owner_slug === route.slug)} loading={directoryLoading} error={directoryError} onRetry={() => setDirectoryRefresh((value) => value + 1)} onBack={() => selectSection('Businesses')} onOpenService={openService} onNavigate={selectSection} />
            : <BusinessesPage rows={filteredBusinesses} totalCount={businesses.length} loading={directoryLoading} error={directoryError} onRetry={() => setDirectoryRefresh((value) => value + 1)} onOpenBusiness={openBusiness} />)}
          {section === 'Services' && (route.slug
            ? <ServiceDetailPage service={selectedService} loading={directoryLoading} error={directoryError} onRetry={() => setDirectoryRefresh((value) => value + 1)} onBack={() => selectSection('Services')} onOpenBusiness={openBusiness} />
            : <ServicesPage rows={filteredServices} totalCount={services.length} loading={directoryLoading} error={directoryError} onRetry={() => setDirectoryRefresh((value) => value + 1)} onOpenService={openService} onOpenBusiness={openBusiness} />)}
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

function Overview({ onNavigate, onOpenBusiness, onOpenService, onRetry, filteredBusinesses, filteredServices, businessCount, activeBusinessCount, serviceCount, activeServiceCount, loading, error }: { onNavigate: (section: Section) => void; onOpenBusiness: (slug: string) => void; onOpenService: (slug: string) => void; onRetry: () => void; filteredBusinesses: BusinessRow[]; filteredServices: Service[]; businessCount: number; activeBusinessCount: number; serviceCount: number; activeServiceCount: number; loading: boolean; error: boolean }) {
  const totalValue = (count: number) => loading ? '…' : error ? 'Unavailable' : String(count)

  return (
    <>
      <PageHeading eyebrow="DRIXEL LABS INC  /  GROUP ADMINISTRATION" title="Portfolio overview" description="A live register of the businesses and services connected to the group." />

      <section className={`status-banner ${error ? 'status-banner-error' : loading ? 'status-banner-loading' : 'status-banner-connected'}`} role="status">
        <div className="status-copy">
          <span className="status-kicker">DIRECTORY STATUS</span>
          <strong>{loading ? 'Connecting to the group directory' : error ? 'Directory connection unavailable' : 'Group directory is connected'}</strong>
          <p>{loading ? 'Loading current business and service records.' : error ? 'Check that Docker and the API are running, then retry.' : 'Business and service records are being read from the Drixel directory.'}</p>
        </div>
        <div className="status-actions">
          <button className="button button-secondary" onClick={onRetry}>{error ? 'Retry connection' : 'Refresh directory'}</button>
          <button className="button button-quiet" onClick={() => onNavigate('Settings')}>Directory settings</button>
        </div>
      </section>

      <section className="metric-grid" aria-label="Live portfolio summary">
        <Metric label="Businesses" value={totalValue(businessCount)} detail="Registered group units" onClick={() => onNavigate('Businesses')} />
        <Metric label="Active businesses" value={totalValue(activeBusinessCount)} detail={error ? 'Unavailable' : 'Currently active'} />
        <Metric label="Services" value={totalValue(serviceCount)} detail="Products and shared services" onClick={() => onNavigate('Services')} />
        <Metric label="Active services" value={totalValue(activeServiceCount)} detail={error ? 'Unavailable' : 'Currently active'} />
      </section>

      <div className="overview-grid">
        <section className="content-panel overview-businesses">
          <div className="panel-heading">
            <div><h2>Businesses</h2><p>Operating units registered under Drixel Labs Inc.</p></div>
            <a className="text-button" href={sectionPaths.Businesses} onClick={(event) => followSectionLink(event, () => onNavigate('Businesses'))}>All businesses <span aria-hidden="true">→</span></a>
          </div>
          <BusinessTable rows={filteredBusinesses} compact onOpenBusiness={onOpenBusiness} />
        </section>

        <section className="content-panel overview-services">
          <div className="panel-heading">
            <div><h2>Services</h2><p>Products and shared group services.</p></div>
            <a className="text-button" href={sectionPaths.Services} onClick={(event) => followSectionLink(event, () => onNavigate('Services'))}>All services <span aria-hidden="true">→</span></a>
          </div>
          <div className="service-summary-list">
            {filteredServices.slice(0, 5).map((service) => (
              <div className="service-summary-row" key={service.slug}>
                <a href={`/services/${encodeURIComponent(service.slug)}`} onClick={(event) => followSectionLink(event, () => onOpenService(service.slug))}><strong>{service.name}</strong></a>
                <a href={`/businesses/${encodeURIComponent(service.owner_slug)}`} onClick={(event) => followSectionLink(event, () => onOpenBusiness(service.owner_slug))}>{service.owner_name}</a>
                <span className="service-type">{statusLabel(service.status)}</span>
              </div>
            ))}
            {!loading && filteredServices.length === 0 && <div className="empty-table">{error ? 'Services are unavailable while the directory is disconnected.' : 'No services match this search.'}</div>}
          </div>
        </section>
      </div>

      <section className="readiness-panel">
        <div className="readiness-copy">
          <span className="eyebrow">IDENTITY AND ACCESS</span>
          <h2>Account administration is not connected</h2>
          <p>Drixel ID and an authenticated management API are required before this console can list accounts, invite users, or change permissions.</p>
        </div>
        <button className="button button-secondary" onClick={() => onNavigate('Settings')}>Review setup</button>
      </section>
      <footer className="page-footer">Directory records are read-only in this console. Account and access data remain protected until identity services are configured.</footer>
    </>
  )
}

function Metric({ label, value, detail, onClick }: { label: string; value: string; detail: string; onClick?: () => void }) {
  const content = <><span className="metric-label">{label}</span><strong className="metric-value">{value}</strong><span className="metric-detail">{detail}</span></>
  return onClick
    ? <button type="button" className="metric-card metric-card-button" onClick={onClick}>{content}<span className="metric-arrow" aria-hidden="true">→</span></button>
    : <div className="metric-card">{content}</div>
}

function DirectoryNotice({ loading, error, onRetry }: { loading: boolean; error: boolean; onRetry: () => void }) {
  if (!loading && !error) return null
  return <div className="status-banner" role="status"><div><strong>{loading ? 'Loading the group directory' : 'Group directory unavailable'}</strong><p>{loading ? 'Reading current business and service records.' : 'Start the local API and database, then retry to load current records.'}</p></div>{error && <button className="button button-secondary" onClick={onRetry}>Retry</button>}</div>
}

type StatusFilter = 'all' | 'active' | 'suspended' | 'closed'
type SortDirection = 'asc' | 'desc'
type DirectorySort = { key: string; direction: SortDirection }

function sortDirectoryRows<T>(rows: T[], sort: DirectorySort, valueFor: (row: T, key: string) => string) {
  const multiplier = sort.direction === 'asc' ? 1 : -1
  return [...rows].sort((left, right) => valueFor(left, sort.key).localeCompare(valueFor(right, sort.key), undefined, { numeric: true, sensitivity: 'base' }) * multiplier)
}

function SortableHeader({ label, sortKey, sort, onSort }: { label: string; sortKey: string; sort: DirectorySort; onSort: (key: string) => void }) {
  const active = sort.key === sortKey
  return <th aria-sort={active ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'}><button className="sort-button" type="button" onClick={() => onSort(sortKey)} aria-label={`Sort by ${label}${active ? `, ${sort.direction === 'asc' ? 'ascending' : 'descending'}` : ''}`}>{label}<span aria-hidden="true">{active ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span></button></th>
}

function DirectoryPagination({ total, page, pageSize, onPageChange, onPageSizeChange }: { total: number; page: number; pageSize: number; onPageChange: (page: number) => void; onPageSizeChange: (pageSize: number) => void }) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)
  return <div className="directory-pagination">
    <p>Showing <strong>{first}–{last}</strong> of <strong>{total}</strong></p>
    <label className="page-size-control"><span>Rows per page</span><select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label>
    <div className="pagination-actions"><button className="button button-secondary" type="button" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>Previous</button><span>Page {page} of {pageCount}</span><button className="button button-secondary" type="button" onClick={() => onPageChange(page + 1)} disabled={page >= pageCount}>Next</button></div>
  </div>
}

function CsvExportButton({ label, filename, headers, rows }: { label: string; filename: string; headers: string[]; rows: string[][] }) {
  const exportCsv = () => {
    const safeCell = (value: string) => {
      const safeValue = /^[\t\r\n ]*[=+\-@]/.test(value) ? `'${value}` : value
      return `"${safeValue.replaceAll('"', '""')}"`
    }
    const contents = [headers, ...rows].map((row) => row.map(safeCell).join(',')).join('\r\n')
    const blob = new Blob([`\uFEFF${contents}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  return <button className="button button-secondary" type="button" onClick={exportCsv}>{label}</button>
}

function StatusFilterControl({ value, onChange }: { value: StatusFilter; onChange: (value: StatusFilter) => void }) {
  return (
    <label className="status-filter">
      <span>Status</span>
      <select value={value} onChange={(event) => onChange(event.target.value as StatusFilter)}>
        <option value="all">All statuses</option>
        <option value="active">Active</option>
        <option value="suspended">Suspended</option>
        <option value="closed">Closed</option>
      </select>
    </label>
  )
}

function BusinessFilterControl({ value, businesses, onChange }: { value: string; businesses: string[]; onChange: (value: string) => void }) {
  return <label className="status-filter"><span>Business</span><select value={value} onChange={(event) => onChange(event.target.value)}><option value="all">All businesses</option>{businesses.map((business) => <option key={business} value={business}>{business}</option>)}</select></label>
}

function BusinessesPage({ rows, totalCount, loading, error, onRetry, onOpenBusiness }: { rows: BusinessRow[]; totalCount: number; loading: boolean; error: boolean; onRetry: () => void; onOpenBusiness: (slug: string) => void }) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sort, setSort] = useState<DirectorySort>({ key: 'name', direction: 'asc' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const filteredRows = statusFilter === 'all' ? rows : rows.filter((row) => row.status === statusFilter)
  const sortedRows = sortDirectoryRows(filteredRows, sort, (row, key) => key === 'category' ? row.category : key === 'services' ? row.services : key === 'status' ? row.status : row.name)
  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const pageRows = sortedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const exportRows = sortedRows.map((row) => [row.name, row.category, row.services, statusLabel(row.status)])
  const toggleSort = (key: string) => { setSort((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' })); setPage(1) }

  return <>
    <PageHeading eyebrow="PORTFOLIO" title="Businesses" description="Review the operating units connected to Drixel Labs Inc." />
    <DirectoryNotice loading={loading} error={error} onRetry={onRetry} />
    <div className="content-panel">
      <div className="panel-heading directory-panel-heading">
        <div><h2>Registered businesses</h2><p>{sortedRows.length} matching · {totalCount} total in the group directory</p></div>
        <span className="panel-meta">READ ONLY</span>
      </div>
      <div className="directory-toolbar">
        {!loading && !error ? <><StatusFilterControl value={statusFilter} onChange={(value) => { setStatusFilter(value); setPage(1) }} /><CsvExportButton label="Export matching CSV" filename="drixel-businesses.csv" headers={['Business', 'Type', 'Services', 'Status']} rows={exportRows} /></> : <span className="directory-toolbar-note">Filters and export are available when the directory is connected.</span>}
      </div>
      <BusinessTable rows={pageRows} onOpenBusiness={onOpenBusiness} onSort={toggleSort} sort={sort} emptyMessage={statusFilter === 'all' ? 'No businesses match the current search.' : `No ${statusFilter} businesses match the current search.`} />
      <DirectoryPagination total={sortedRows.length} page={currentPage} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(value) => { setPageSize(value); setPage(1) }} />
    </div>
    <footer className="page-footer">Business records are read from the PostgreSQL group directory. Editing requires the authenticated management API.</footer>
  </>
}

function BusinessTable({ rows, compact = false, emptyMessage = 'No business units are available.', onOpenBusiness, onSort, sort }: { rows: BusinessRow[]; compact?: boolean; emptyMessage?: string; onOpenBusiness?: (slug: string) => void; onSort?: (key: string) => void; sort?: DirectorySort }) {
  const headers = onSort && sort ? <tr><SortableHeader label="BUSINESS" sortKey="name" sort={sort} onSort={onSort} /><SortableHeader label="TYPE" sortKey="category" sort={sort} onSort={onSort} /><SortableHeader label="SERVICES" sortKey="services" sort={sort} onSort={onSort} /><SortableHeader label="STATUS" sortKey="status" sort={sort} onSort={onSort} /></tr> : <tr><th scope="col">BUSINESS</th><th scope="col">TYPE</th><th scope="col">SERVICES</th><th scope="col">STATUS</th></tr>
  return (
    <div className={`table-scroll ${compact ? 'table-scroll-compact' : ''}`}>
      <table className="data-table"><thead>{headers}</thead>
        <tbody>{rows.map((row) => <tr key={row.id}><td><a className="table-primary table-record-link" href={`/businesses/${encodeURIComponent(row.slug)}`} onClick={(event) => onOpenBusiness && followSectionLink(event, () => onOpenBusiness(row.slug))}>{row.name}</a></td><td>{row.category}</td><td>{row.services}</td><td><span className="status-tag">{statusLabel(row.status)}</span></td></tr>)}
        {rows.length === 0 && <tr><td className="empty-table" colSpan={4}>{emptyMessage}</td></tr>}</tbody>
      </table>
    </div>
  )
}

function ServicesPage({ rows, totalCount, loading, error, onRetry, onOpenService, onOpenBusiness }: { rows: Service[]; totalCount: number; loading: boolean; error: boolean; onRetry: () => void; onOpenService: (slug: string) => void; onOpenBusiness: (slug: string) => void }) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [businessFilter, setBusinessFilter] = useState('all')
  const [sort, setSort] = useState<DirectorySort>({ key: 'name', direction: 'asc' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const businesses = [...new Set(rows.map((row) => row.owner_name))].sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }))
  const filteredRows = rows.filter((row) => (statusFilter === 'all' || row.status === statusFilter) && (businessFilter === 'all' || row.owner_name === businessFilter))
  const sortedRows = sortDirectoryRows(filteredRows, sort, (row, key) => key === 'owner' ? row.owner_name : key === 'status' ? row.status : row.name)
  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const pageRows = sortedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const exportRows = sortedRows.map((row) => [row.name, row.owner_name, statusLabel(row.status)])
  const toggleSort = (key: string) => { setSort((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' })); setPage(1) }

  return <>
    <PageHeading eyebrow="PORTFOLIO" title="Services" description="Review products and services owned by Drixel businesses." />
    <DirectoryNotice loading={loading} error={error} onRetry={onRetry} />
    <div className="content-panel">
      <div className="panel-heading directory-panel-heading">
        <div><h2>Registered services</h2><p>{sortedRows.length} matching · {totalCount} total in the group directory</p></div>
        <span className="panel-meta">READ ONLY</span>
      </div>
      <div className="directory-toolbar">
        {!loading && !error ? <><StatusFilterControl value={statusFilter} onChange={(value) => { setStatusFilter(value); setPage(1) }} /><BusinessFilterControl value={businessFilter} businesses={businesses} onChange={(value) => { setBusinessFilter(value); setPage(1) }} /><CsvExportButton label="Export matching CSV" filename="drixel-services.csv" headers={['Service', 'Business', 'Status']} rows={exportRows} /></> : <span className="directory-toolbar-note">Filters and export are available when the directory is connected.</span>}
      </div>
      <div className="table-scroll"><table className="data-table"><thead><tr><SortableHeader label="SERVICE" sortKey="name" sort={sort} onSort={toggleSort} /><SortableHeader label="BUSINESS" sortKey="owner" sort={sort} onSort={toggleSort} /><SortableHeader label="STATUS" sortKey="status" sort={sort} onSort={toggleSort} /></tr></thead><tbody>{pageRows.map((row) => <tr key={row.id}><td><a className="table-primary table-record-link" href={`/services/${encodeURIComponent(row.slug)}`} onClick={(event) => followSectionLink(event, () => onOpenService(row.slug))}>{row.name}</a></td><td><a className="table-record-link" href={`/businesses/${encodeURIComponent(row.owner_slug)}`} onClick={(event) => followSectionLink(event, () => onOpenBusiness(row.owner_slug))}>{row.owner_name}</a></td><td><span className="status-tag">{statusLabel(row.status)}</span></td></tr>)}{pageRows.length === 0 && <tr><td className="empty-table" colSpan={3}>{sortedRows.length === 0 ? (businessFilter !== 'all' ? `No ${statusFilter === 'all' ? '' : `${statusFilter} `}services for ${businessFilter}.` : statusFilter === 'all' ? 'No services match the current search.' : `No ${statusFilter} services match the current search.`) : 'No services on this page.'}</td></tr>}</tbody></table></div>
      <DirectoryPagination total={sortedRows.length} page={currentPage} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(value) => { setPageSize(value); setPage(1) }} />
    </div>
    <footer className="page-footer">Each service has one owning business and its own data boundary. Registration requires the authenticated management API.</footer>
  </>
}

function RecordNotFound({ kind, slug, onBack }: { kind: 'business' | 'service'; slug: string; onBack: () => void }) {
  return <>
    <PageHeading eyebrow="PORTFOLIO RECORD" title={`${kind === 'business' ? 'Business' : 'Service'} not found`} description={`The directory does not contain a ${kind} with the identifier “${slug}”.`} />
    <div className="record-not-found"><strong>This record may have been removed or its address may be incorrect.</strong><button className="button button-secondary" onClick={onBack}>Back to {kind === 'business' ? 'businesses' : 'services'}</button></div>
  </>
}

function BusinessDetailPage({ business, services, loading, error, onRetry, onBack, onOpenService, onNavigate }: { business?: BusinessRow; services: Service[]; loading: boolean; error: boolean; onRetry: () => void; onBack: () => void; onOpenService: (slug: string) => void; onNavigate: (section: Section) => void }) {
  if (!business && !loading && !error) return <RecordNotFound kind="business" slug={window.location.pathname.split('/').at(-1) ?? ''} onBack={onBack} />
  if (!business) return <><PageHeading eyebrow="PORTFOLIO" title="Business record" description="Loading the selected business from the group directory." /><DirectoryNotice loading={loading} error={error} onRetry={onRetry} /></>

  return <>
    <PageHeading eyebrow="BUSINESS RECORD" title={business.name} description="Business information and services registered in the Drixel group directory." action={<button className="button button-secondary" onClick={onBack}>All businesses</button>} />
    <DirectoryNotice loading={loading} error={error} onRetry={onRetry} />
    <div className="detail-grid">
      <section className="content-panel detail-card"><div className="panel-heading"><div><h2>Business profile</h2><p>Current directory record</p></div><span className="status-tag">{statusLabel(business.status)}</span></div><dl className="detail-facts"><div><dt>Business name</dt><dd>{business.name}</dd></div><div><dt>Directory address</dt><dd>{business.slug}</dd></div><div><dt>Organization type</dt><dd>{business.category}</dd></div><div><dt>Registered services</dt><dd>{services.length}</dd></div></dl></section>
      <section className="content-panel detail-card"><div className="panel-heading"><div><h2>Services</h2><p>Services owned by this business</p></div><span className="panel-meta">{services.length} REGISTERED</span></div>{services.length ? <div className="related-record-list">{services.map((service) => <a className="related-record" key={service.id} href={`/services/${encodeURIComponent(service.slug)}`} onClick={(event) => followSectionLink(event, () => onOpenService(service.slug))}><span><strong>{service.name}</strong><small>Service record</small></span><span className="status-tag">{statusLabel(service.status)}</span></a>)}</div> : <div className="related-empty">No services are currently registered to this business.</div>}</section>
    </div>
    <div className="record-context"><strong>Group parent</strong><a href={sectionPaths.Overview} onClick={(event) => followSectionLink(event, () => onNavigate('Overview'))}>Drixel Labs Inc</a><span>Directory records are read-only in this console.</span></div>
  </>
}

function ServiceDetailPage({ service, loading, error, onRetry, onBack, onOpenBusiness }: { service?: Service; loading: boolean; error: boolean; onRetry: () => void; onBack: () => void; onOpenBusiness: (slug: string) => void }) {
  if (!service && !loading && !error) return <RecordNotFound kind="service" slug={window.location.pathname.split('/').at(-1) ?? ''} onBack={onBack} />
  if (!service) return <><PageHeading eyebrow="PORTFOLIO" title="Service record" description="Loading the selected service from the group directory." /><DirectoryNotice loading={loading} error={error} onRetry={onRetry} /></>

  return <>
    <PageHeading eyebrow="SERVICE RECORD" title={service.name} description="Service information and ownership from the Drixel group directory." action={<button className="button button-secondary" onClick={onBack}>All services</button>} />
    <DirectoryNotice loading={loading} error={error} onRetry={onRetry} />
    <section className="content-panel detail-card"><div className="panel-heading"><div><h2>Service profile</h2><p>Current directory record</p></div><span className="status-tag">{statusLabel(service.status)}</span></div><dl className="detail-facts"><div><dt>Service name</dt><dd>{service.name}</dd></div><div><dt>Directory address</dt><dd>{service.slug}</dd></div><div><dt>Owning business</dt><dd><a className="detail-owner-link" href={`/businesses/${encodeURIComponent(service.owner_slug)}`} onClick={(event) => followSectionLink(event, () => onOpenBusiness(service.owner_slug))}>{service.owner_name} <span aria-hidden="true">→</span></a></dd></div><div><dt>Access boundary</dt><dd>Owned by {service.owner_name}</dd></div></dl></section>
    <footer className="page-footer">Service membership and account access are managed through Drixel ID when identity services are connected.</footer>
  </>
}

function AccountsPage({ onNavigate }: { onNavigate: (section: Section) => void }) {
  return <><PageHeading eyebrow="IDENTITY" title="Accounts" description="Review employee and user identities across Drixel services." /><div className="setup-panel"><div className="setup-index">01</div><div className="setup-copy"><span className="eyebrow">REQUIRED SETUP</span><h2>Connect Drixel ID to an identity provider</h2><p>Accounts are not loaded from a live identity provider yet. Once connected, this page will show verified identities, employee and customer memberships, and service access.</p><ul><li>One person can use a single sign-in across Drixel services.</li><li>Employee and customer access remain separate.</li><li>Each business only sees accounts and permissions in its own scope.</li></ul><div className="setup-actions"><button className="button button-primary" onClick={() => onNavigate('Settings')}>Open identity settings</button><span>Account data is not simulated.</span></div></div></div><div className="info-strip"><strong>Storage model</strong><span>Global account IDs with separate organization memberships and product roles.</span></div><footer className="page-footer">Account listing and invitations require a connected identity provider and authenticated management API.</footer></>
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
  return <><PageHeading eyebrow="CONFIGURATION" title="Settings" description="Configure the shared identity and group directory services." /><section className="content-panel settings-section"><div className="panel-heading"><div><h2>Identity provider</h2><p>Single sign-on and account verification.</p></div><span className="status-tag status-tag-muted">Not connected</span></div><div className="settings-row"><div><strong>Provider</strong><span>Not selected</span></div><div><strong>Protocol</strong><span>OpenID Connect</span></div><div><strong>Multi-factor authentication</strong><span>Required for administrators</span></div></div><div className="settings-note">Provider setup is pending. Configuration controls will appear after an authenticated identity management service is connected.</div></section><section className="content-panel settings-section"><div className="panel-heading"><div><h2>Group directory</h2><p>Business and service registry in PostgreSQL.</p></div><span className={`status-tag ${directoryConnected ? '' : 'status-tag-muted'}`}>{directoryConnected ? 'Connected' : 'Unavailable'}</span></div><div className="settings-row"><div><strong>Parent organization</strong><span>Drixel Labs Inc</span></div><div><strong>Business units</strong><span>{directoryConnected ? `${businessCount} registered` : 'Unavailable'}</span></div><div><strong>Services</strong><span>{directoryConnected ? `${serviceCount} registered` : 'Unavailable'}</span></div></div></section><section className="content-panel settings-section"><div className="panel-heading"><div><h2>Security boundaries</h2><p>Current database controls.</p></div></div><ul className="security-list"><li>The portfolio API uses a dedicated read-only database role.</li><li>Row-level security hides customer workspaces from the portfolio API.</li><li>Account data remains unavailable until Drixel ID is connected.</li></ul></section><footer className="page-footer">Identity and account administration require an authenticated management API.</footer></>
}

export default App
