import { useEffect, useMemo, useState, type FormEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { AdminShell } from './components/admin/AdminShell'
import { Button, EmptyState, PageHeader, SectionCard, SectionHeader, StatStrip, StatusPill, TableRowLink } from './components/admin/ui'

type Section = 'Overview' | 'Businesses' | 'Services' | 'Accounts' | 'Access roles' | 'Audit log' | 'Settings'

type Business = { id: string; slug: string; name: string; kind: string; status: string }
type Service = { id: string; slug: string; name: string; status: string; owner_slug: string; owner_name: string }
type Portfolio = { businesses: Business[]; services: Service[] }
type BusinessRow = Business & { category: string; services: string }
type AppRoute = { section: Section; slug?: string; acceptToken?: string }

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
  if (pathname === '/auth/callback') return { section: 'Accounts' }
  if (pathname === '/accept-invitation') return { section: 'Accounts', acceptToken: decodeURIComponent(window.location.hash.slice(1)) }
  return { section: 'Overview' }
}

const oidcConfig = {
  issuer: import.meta.env.VITE_OIDC_ISSUER as string | undefined,
  authorizationEndpoint: import.meta.env.VITE_OIDC_AUTHORIZATION_ENDPOINT as string | undefined,
  tokenEndpoint: import.meta.env.VITE_OIDC_TOKEN_ENDPOINT as string | undefined,
  clientId: import.meta.env.VITE_OIDC_CLIENT_ID as string | undefined,
  audience: import.meta.env.VITE_OIDC_AUDIENCE as string | undefined,
}
const oidcConfigured = Boolean(oidcConfig.issuer && oidcConfig.audience && oidcConfig.authorizationEndpoint && oidcConfig.tokenEndpoint && oidcConfig.clientId)
const oidcRedirectUri = `${window.location.origin}/auth/callback`

function base64Url(bytes: Uint8Array) {
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function randomToken(size = 32) {
  const bytes = new Uint8Array(size)
  window.crypto.getRandomValues(bytes)
  return base64Url(bytes)
}

function readJwtPayload(token: string) {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(part.padEnd(Math.ceil(part.length / 4) * 4, '='))) as Record<string, unknown>
  }
  catch { throw new Error('Identity provider returned an invalid ID token') }
}

async function beginOidcLogin() {
  if (!oidcConfigured || !window.isSecureContext) return false
  const state = randomToken()
  const nonce = randomToken()
  const verifier = randomToken(48)
  const challenge = base64Url(new Uint8Array(await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))))
  const returnTo = `${window.location.pathname}${window.location.hash}`
  sessionStorage.setItem('drixel-oidc-transaction', JSON.stringify({ state, nonce, verifier, returnTo }))
  const authorization = new URL(oidcConfig.authorizationEndpoint!)
  authorization.searchParams.set('client_id', oidcConfig.clientId!)
  authorization.searchParams.set('response_type', 'code')
  authorization.searchParams.set('redirect_uri', oidcRedirectUri)
  authorization.searchParams.set('scope', 'openid profile email')
  authorization.searchParams.set('state', state)
  authorization.searchParams.set('nonce', nonce)
  authorization.searchParams.set('code_challenge', challenge)
  authorization.searchParams.set('code_challenge_method', 'S256')
  if (oidcConfig.audience) authorization.searchParams.set('audience', oidcConfig.audience)
  window.location.assign(authorization.toString())
  return true
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
  const [accessToken, setAccessToken] = useState<string | undefined>(() => sessionStorage.getItem('drixel-access-token') ?? undefined)
  const [idToken, setIdToken] = useState<string | undefined>(() => sessionStorage.getItem('drixel-id-token') ?? undefined)
  const [authError, setAuthError] = useState('')
  const [portfolio, setPortfolio] = useState<Portfolio>(emptyPortfolio)
  const [directoryLoading, setDirectoryLoading] = useState(true)
  const [directoryError, setDirectoryError] = useState(false)
  const [directoryRefresh, setDirectoryRefresh] = useState(0)

  useEffect(() => {
    if (window.location.pathname !== '/auth/callback') return
    const finishLogin = async () => {
      const transactionText = sessionStorage.getItem('drixel-oidc-transaction')
      sessionStorage.removeItem('drixel-oidc-transaction')
      let transaction: { state: string; nonce: string; verifier: string; returnTo: string } | undefined
      try { transaction = transactionText ? JSON.parse(transactionText) as { state: string; nonce: string; verifier: string; returnTo: string } : undefined }
      catch { transaction = undefined }
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      if (!transaction || !code || !params.get('state') || params.get('state') !== transaction.state) {
        setAuthError('Sign-in could not be verified. Start again from the sign-in button.')
        window.history.replaceState(null, '', '/accounts')
        setRoute({ section: 'Accounts' })
        return
      }
      try {
        const tokenResponse = await fetch(oidcConfig.tokenEndpoint!, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: oidcConfig.clientId!,
            code,
            redirect_uri: oidcRedirectUri,
            code_verifier: transaction.verifier,
          }),
          credentials: 'omit',
        })
        const tokens = await tokenResponse.json() as { access_token?: string; id_token?: string }
        if (!tokenResponse.ok || !tokens.access_token || !tokens.id_token) throw new Error('Token exchange failed')
        const idClaims = readJwtPayload(tokens.id_token)
        const idAudiences = Array.isArray(idClaims.aud) ? idClaims.aud : [idClaims.aud]
        if (idClaims.iss !== oidcConfig.issuer || !idAudiences.includes(oidcConfig.clientId) || idClaims.nonce !== transaction.nonce) {
          throw new Error('ID token verification failed')
        }
        setAccessToken(tokens.access_token)
        setIdToken(tokens.id_token)
        sessionStorage.setItem('drixel-access-token', tokens.access_token)
        sessionStorage.setItem('drixel-id-token', tokens.id_token)
        setAuthError('')
        const returnTo = transaction.returnTo || '/accounts'
        window.history.replaceState(null, '', returnTo)
        const nextRoute = routeFromPath(window.location.pathname)
        setRoute({ ...nextRoute, acceptToken: window.location.pathname === '/accept-invitation' ? decodeURIComponent(window.location.hash.slice(1)) : undefined })
      } catch {
        setAuthError('Sign-in failed. Check the OIDC client, redirect URI, token endpoint, and browser CORS settings.')
        window.history.replaceState(null, '', '/accounts')
        setRoute({ section: 'Accounts' })
      }
    }
    void finishLogin()
  }, [])

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
      || Boolean(initialRoute.slug) || window.location.pathname === '/accept-invitation'
    if (!knownPath) window.history.replaceState(null, '', sectionPaths.Overview)
    const handlePopState = () => {
      setRoute(routeFromPath(window.location.pathname))
      setQuery('')
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
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
  }

  const selectSection = (next: Section) => navigateTo(sectionPaths[next], { section: next })
  const openBusiness = (slug: string) => navigateTo(`/businesses/${encodeURIComponent(slug)}`, { section: 'Businesses', slug })
  const openService = (slug: string) => navigateTo(`/services/${encodeURIComponent(slug)}`, { section: 'Services', slug })

  const navItems = sections.map((item) => ({
    label: item,
    href: sectionPaths[item],
    active: section === item,
    onClick: () => selectSection(item),
  }))
  const breadcrumbs = route.slug
    ? [
        { label: 'Drixel Labs Inc', onClick: () => selectSection('Overview') },
        { label: section, onClick: () => selectSection(section) },
        { label: selectedBusiness?.name ?? selectedService?.name ?? route.slug },
      ]
    : [{ label: 'Drixel Labs Inc', onClick: () => selectSection('Overview') }, { label: section }]

  const signOut = () => {
    setAccessToken(undefined)
    setIdToken(undefined)
    sessionStorage.removeItem('drixel-access-token')
    sessionStorage.removeItem('drixel-id-token')
    setAuthError('')
  }
  const signIn = () => {
    if (oidcConfigured) void beginOidcLogin().catch(() => setAuthError('Could not start secure sign-in.'))
    else selectSection('Settings')
  }

  return (
    <AdminShell
      items={navItems}
      breadcrumbs={breadcrumbs}
      search={showSearch ? { value: query, placeholder: section === 'Businesses' ? 'Search businesses' : section === 'Services' ? 'Search services' : 'Search portfolio', onChange: setQuery } : undefined}
      authenticated={Boolean(accessToken)}
      oidcConfigured={oidcConfigured}
      onSignIn={signIn}
      onSignOut={signOut}
      onSettings={() => selectSection('Settings')}
    >
      {section === 'Overview' && <Overview onNavigate={selectSection} onOpenBusiness={openBusiness} onOpenService={openService} onRetry={() => setDirectoryRefresh((value) => value + 1)} filteredBusinesses={filteredBusinesses} filteredServices={filteredServices} businessCount={businesses.length} activeBusinessCount={activeBusinessCount} serviceCount={services.length} activeServiceCount={activeServiceCount} loading={directoryLoading} error={directoryError} />}
      {section === 'Businesses' && (route.slug
        ? <BusinessDetailPage business={selectedBusiness} services={services.filter((service) => service.owner_slug === route.slug)} loading={directoryLoading} error={directoryError} onRetry={() => setDirectoryRefresh((value) => value + 1)} onBack={() => selectSection('Businesses')} onOpenService={openService} onNavigate={selectSection} />
        : <BusinessesPage rows={filteredBusinesses} totalCount={businesses.length} loading={directoryLoading} error={directoryError} onRetry={() => setDirectoryRefresh((value) => value + 1)} onOpenBusiness={openBusiness} accessToken={accessToken} onPortfolioChanged={() => setDirectoryRefresh((value) => value + 1)} />)}
      {section === 'Services' && (route.slug
        ? <ServiceDetailPage service={selectedService} loading={directoryLoading} error={directoryError} onRetry={() => setDirectoryRefresh((value) => value + 1)} onBack={() => selectSection('Services')} onOpenBusiness={openBusiness} />
        : <ServicesPage rows={filteredServices} totalCount={services.length} loading={directoryLoading} error={directoryError} onRetry={() => setDirectoryRefresh((value) => value + 1)} onOpenService={openService} onOpenBusiness={openBusiness} accessToken={accessToken} groupBusinesses={businesses} onPortfolioChanged={() => setDirectoryRefresh((value) => value + 1)} />)}
      {section === 'Accounts' && <AccountsPage onNavigate={selectSection} accessToken={accessToken} idToken={idToken} businesses={businesses} services={services} acceptToken={route.acceptToken} onSignIn={signIn} authError={authError} />}
      {section === 'Access roles' && <RolesPage />}
      {section === 'Audit log' && <AuditPage accessToken={accessToken} onSignIn={signIn} />}
      {section === 'Settings' && <SettingsPage businessCount={businesses.length} serviceCount={services.length} directoryConnected={!directoryLoading && !directoryError} authSubject={idToken ? String(readJwtPayload(idToken).sub ?? '') : ''} />}
    </AdminShell>
  )
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <PageHeader eyebrow={eyebrow} title={title} description={description} action={action} />
}

function Overview({ onNavigate, onOpenBusiness, onOpenService, onRetry, filteredBusinesses, filteredServices, businessCount, activeBusinessCount, serviceCount, activeServiceCount, loading, error }: { onNavigate: (section: Section) => void; onOpenBusiness: (slug: string) => void; onOpenService: (slug: string) => void; onRetry: () => void; filteredBusinesses: BusinessRow[]; filteredServices: Service[]; businessCount: number; activeBusinessCount: number; serviceCount: number; activeServiceCount: number; loading: boolean; error: boolean }) {
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
            <h2 className="text-[28px] font-semibold tracking-[-.02em] text-foreground md:text-[32px]">{loading ? 'Reading your group directory' : error ? 'The group directory needs attention' : businessCount + ' businesses, ' + serviceCount + ' services'}</h2>
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

function PortfolioManagementPanel({ type, businesses, services, accessToken, onSaved }: { type: 'business' | 'service'; businesses: Business[]; services: Service[]; accessToken?: string; onSaved: () => void }) {
  const [canManage, setCanManage] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [kind, setKind] = useState('business_unit')
  const [ownerId, setOwnerId] = useState('')
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({})
  const [statusDrafts, setStatusDrafts] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!accessToken) { setCanManage(false); return }
    const controller = new AbortController()
    fetch('/api/portfolio/manage-access', { headers: { Authorization: `Bearer ${accessToken}` }, signal: controller.signal })
      .then((response) => setCanManage(response.ok))
      .catch((reason: unknown) => { if (!(reason instanceof DOMException && reason.name === 'AbortError')) setCanManage(false) })
    return () => controller.abort()
  }, [accessToken])

  const rows = type === 'business' ? businesses : services
  useEffect(() => {
    setNameDrafts(Object.fromEntries(rows.map((row) => [row.id, row.name])))
    setStatusDrafts(Object.fromEntries(rows.map((row) => [row.id, row.status])))
  }, [type, rows])

  if (!canManage || !accessToken) return null
  const createRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return
    setSaving(true); setError(''); setMessage('')
    try {
      const payload = type === 'business' ? { name, slug, kind } : { name, slug, owner_organization_id: ownerId }
      const response = await fetch(`/api/portfolio/${type === 'business' ? 'businesses' : 'services'}`, {
        method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const body = await response.json() as { error?: string }
      if (!response.ok) throw new Error(body.error ?? 'Portfolio record could not be created')
      setName(''); setSlug(''); setOwnerId(''); setMessage(`${type === 'business' ? 'Business' : 'Service'} added to the group directory.`)
      onSaved()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Portfolio record could not be created') }
    finally { setSaving(false) }
  }
  const updateRecord = async (id: string) => {
    setSavingId(id); setError(''); setMessage('')
    try {
      const response = await fetch(`/api/portfolio/${type === 'business' ? 'businesses' : 'services'}/${encodeURIComponent(id)}`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameDrafts[id], status: statusDrafts[id] }),
      })
      const body = await response.json() as { error?: string }
      if (!response.ok) throw new Error(body.error ?? 'Portfolio record could not be updated')
      setMessage('Portfolio record updated and recorded in the audit log.')
      onSaved()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Portfolio record could not be updated') }
    finally { setSavingId('') }
  }
  const label = type === 'business' ? 'business' : 'service'
  return <section className="content-panel portfolio-management">
    <div className="panel-heading"><div><h2>Manage {type === 'business' ? 'businesses' : 'services'}</h2><p>Add records or update names and statuses. Every change is written to the audit log.</p></div><span className="panel-meta">GROUP ADMIN</span></div>
    <form className="portfolio-create-form" onSubmit={createRecord}>
      <label>{type === 'business' ? 'Business name' : 'Service name'}<input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>Directory slug<input required maxLength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*" title="Use lowercase letters, numbers, and hyphens." value={slug} onChange={(event) => setSlug(event.target.value)} /></label>
      {type === 'business' ? <label>Business type<select value={kind} onChange={(event) => setKind(event.target.value)}><option value="business_unit">Business unit</option><option value="subsidiary">Subsidiary</option></select></label> : <label>Owning business<select required value={ownerId} onChange={(event) => setOwnerId(event.target.value)}><option value="">Choose a business</option>{businesses.filter((business) => business.status !== 'closed').map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}</select></label>}
      <div className="portfolio-create-submit"><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Adding…' : `Add ${label}`}</button></div>
    </form>
    {message && <p className="portfolio-feedback" role="status">{message}</p>}
    {error && <p className="portfolio-feedback portfolio-feedback-error" role="alert">{error}</p>}
    <div className="table-scroll"><table className="data-table"><thead><tr><th>NAME</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>
      {rows.map((row) => <tr key={row.id}><td><label className="visually-hidden" htmlFor={`${type}-name-${row.id}`}>{label} name</label><input id={`${type}-name-${row.id}`} className="portfolio-row-input" maxLength={120} value={nameDrafts[row.id] ?? row.name} onChange={(event) => setNameDrafts((current) => ({ ...current, [row.id]: event.target.value }))} /></td><td><label className="visually-hidden" htmlFor={`${type}-status-${row.id}`}>{label} status</label><select id={`${type}-status-${row.id}`} className="portfolio-row-select" value={statusDrafts[row.id] ?? row.status} onChange={(event) => setStatusDrafts((current) => ({ ...current, [row.id]: event.target.value }))}><option value="active">Active</option><option value="suspended">Suspended</option><option value="closed">Closed</option></select></td><td><button className="button button-secondary" type="button" disabled={savingId === row.id || !nameDrafts[row.id]?.trim()} onClick={() => void updateRecord(row.id)}>{savingId === row.id ? 'Saving…' : 'Save changes'}</button></td></tr>)}
      {rows.length === 0 && <tr><td colSpan={3} className="empty-table">No records are available to manage.</td></tr>}
    </tbody></table></div>
  </section>
}

function BusinessesPage({ rows, totalCount, loading, error, onRetry, onOpenBusiness, accessToken, onPortfolioChanged }: { rows: BusinessRow[]; totalCount: number; loading: boolean; error: boolean; onRetry: () => void; onOpenBusiness: (slug: string) => void; accessToken?: string; onPortfolioChanged: () => void }) {
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
    <PortfolioManagementPanel type="business" businesses={rows} services={[]} accessToken={accessToken} onSaved={onPortfolioChanged} />
    <DirectoryNotice loading={loading} error={error} onRetry={onRetry} />
    <div className="content-panel">
      <div className="panel-heading directory-panel-heading">
        <div><h2>Registered businesses</h2><p>{sortedRows.length} matching · {totalCount} total in the group directory</p></div>
        <span className="panel-meta">LIVE DIRECTORY</span>
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

function ServicesPage({ rows, totalCount, loading, error, onRetry, onOpenService, onOpenBusiness, accessToken, groupBusinesses, onPortfolioChanged }: { rows: Service[]; totalCount: number; loading: boolean; error: boolean; onRetry: () => void; onOpenService: (slug: string) => void; onOpenBusiness: (slug: string) => void; accessToken?: string; groupBusinesses: BusinessRow[]; onPortfolioChanged: () => void }) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [businessFilter, setBusinessFilter] = useState('all')
  const [sort, setSort] = useState<DirectorySort>({ key: 'name', direction: 'asc' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const businessNames = [...new Set(rows.map((row) => row.owner_name))].sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }))
  const filteredRows = rows.filter((row) => (statusFilter === 'all' || row.status === statusFilter) && (businessFilter === 'all' || row.owner_name === businessFilter))
  const sortedRows = sortDirectoryRows(filteredRows, sort, (row, key) => key === 'owner' ? row.owner_name : key === 'status' ? row.status : row.name)
  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const pageRows = sortedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const exportRows = sortedRows.map((row) => [row.name, row.owner_name, statusLabel(row.status)])
  const toggleSort = (key: string) => { setSort((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' })); setPage(1) }

  return <>
    <PageHeading eyebrow="PORTFOLIO" title="Services" description="Review products and services owned by Drixel businesses." />
    <PortfolioManagementPanel type="service" businesses={groupBusinesses} services={rows} accessToken={accessToken} onSaved={onPortfolioChanged} />
    <DirectoryNotice loading={loading} error={error} onRetry={onRetry} />
    <div className="content-panel">
      <div className="panel-heading directory-panel-heading">
        <div><h2>Registered services</h2><p>{sortedRows.length} matching · {totalCount} total in the group directory</p></div>
        <span className="panel-meta">LIVE DIRECTORY</span>
      </div>
      <div className="directory-toolbar">
      {!loading && !error ? <><StatusFilterControl value={statusFilter} onChange={(value) => { setStatusFilter(value); setPage(1) }} /><BusinessFilterControl value={businessFilter} businesses={businessNames} onChange={(value) => { setBusinessFilter(value); setPage(1) }} /><CsvExportButton label="Export matching CSV" filename="drixel-services.csv" headers={['Service', 'Business', 'Status']} rows={exportRows} /></> : <span className="directory-toolbar-note">Filters and export are available when the directory is connected.</span>}
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

type AccountRow = { id: string; display_name: string; status: string; email: string | null; organization_id: string; organization_name: string; service_name: string | null; application_id: string | null; membership_kind: string; membership_status: string; role_code: string | null }
type AccountAccessDraft = { role_code: string; membership_status: 'active' | 'suspended' }
const accountAccessKey = (account: AccountRow) => `${account.id}:${account.organization_id}:${account.application_id ?? 'business'}`

function AccountsPage({ onNavigate, accessToken, idToken, businesses, services, acceptToken, onSignIn, authError }: { onNavigate: (section: Section) => void; accessToken?: string; idToken?: string; businesses: BusinessRow[]; services: Service[]; acceptToken?: string; onSignIn: () => void; authError: string }) {
  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [accessDrafts, setAccessDrafts] = useState<Record<string, AccountAccessDraft>>({})
  const [savingAccessKey, setSavingAccessKey] = useState('')
  const [canAssignBusinessAdmin, setCanAssignBusinessAdmin] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [organizationId, setOrganizationId] = useState('')
  const [applicationId, setApplicationId] = useState('')
  const [roleCode, setRoleCode] = useState('employee')
  const [membershipKind, setMembershipKind] = useState('employee')
  const [inviteLink, setInviteLink] = useState('')
  const [saving, setSaving] = useState(false)
  const selectedBusinessSlug = businesses.find((business) => business.id === organizationId)?.slug
  const availableServices = selectedBusinessSlug ? services.filter((service) => service.owner_slug === selectedBusinessSlug && service.status === 'active') : []

  useEffect(() => {
    if (!accessToken || acceptToken) return
    const controller = new AbortController()
    setLoading(true)
    fetch('/api/accounts', { headers: { Authorization: `Bearer ${accessToken}` }, signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as { accounts?: AccountRow[]; can_assign_business_admin?: boolean; error?: string }
        if (!response.ok) throw new Error(body.error ?? 'Account directory is unavailable')
        setAccounts(body.accounts ?? [])
        setAccessDrafts(Object.fromEntries((body.accounts ?? []).map((account) => [accountAccessKey(account), {
          role_code: account.role_code ?? (account.application_id ? 'end_user' : 'employee'),
          membership_status: account.membership_status === 'suspended' ? 'suspended' as const : 'active' as const,
        }])))
        setCanAssignBusinessAdmin(Boolean(body.can_assign_business_admin))
        setError('')
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return
        setError(reason instanceof Error ? reason.message : 'Account directory is unavailable')
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [accessToken, acceptToken])

  useEffect(() => {
    if (!accessToken || !acceptToken) return
    const controller = new AbortController()
    fetch('/api/invitations/accept', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: acceptToken, id_token: idToken }),
      signal: controller.signal,
    }).then(async (response) => {
      const body = await response.json() as { error?: string; account_name?: string }
      if (!response.ok) throw new Error(body.error ?? 'Invitation could not be accepted')
      setError('')
      setNotice(`Invitation accepted. Welcome to Drixel, ${body.account_name}.`)
      window.history.replaceState(null, '', '/accounts')
    }).catch((reason: unknown) => {
      if (reason instanceof DOMException && reason.name === 'AbortError') return
      setError(reason instanceof Error ? reason.message : 'Invitation could not be accepted')
    })
    return () => controller.abort()
  }, [accessToken, acceptToken])

  const createInvitation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!accessToken || saving) return
    setSaving(true)
    setError('')
    setNotice('')
    setInviteLink('')
    try {
      const response = await fetch('/api/invitations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, display_name: name, organization_id: organizationId, application_id: applicationId || undefined, role_code: roleCode, membership_kind: membershipKind }),
      })
      const body = await response.json() as { token?: string; error?: string }
      if (!response.ok || !body.token) throw new Error(body.error ?? 'Invitation could not be created')
      const link = `${window.location.origin}/accept-invitation#${encodeURIComponent(body.token)}`
      setInviteLink(link)
      setNotice('Invitation created. Copy the one-time link and send it to the invited person through your approved channel. It expires in 7 days.')
      setName('')
      setEmail('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Invitation could not be created')
    } finally { setSaving(false) }
  }

  const saveAccountAccess = async (account: AccountRow) => {
    if (!accessToken || savingAccessKey) return
    const key = accountAccessKey(account)
    const draft = accessDrafts[key]
    if (!draft) return
    setSavingAccessKey(key)
    setError('')
    setNotice('')
    try {
      const response = await fetch(`/api/accounts/${encodeURIComponent(account.id)}/access`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: account.organization_id,
          application_id: account.application_id ?? undefined,
          role_code: draft.role_code,
          membership_status: draft.membership_status,
        }),
      })
      const body = await response.json() as { error?: string }
      if (!response.ok) throw new Error(body.error ?? 'Access could not be updated')
      setAccounts((current) => current.map((item) => accountAccessKey(item) === key
        ? { ...item, role_code: draft.role_code, membership_status: draft.membership_status }
        : item))
      setNotice(`Access updated for ${account.display_name}. The change was recorded in the audit log.`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Access could not be updated')
    } finally {
      setSavingAccessKey('')
    }
  }

  return <>
    <PageHeading eyebrow="IDENTITY" title="Accounts" description="Manage Drixel identities and business memberships with access scoped to each organization." />
    {authError && <div className="status-banner status-banner-error" role="alert"><strong>{authError}</strong></div>}
    {notice && <div className="status-banner status-banner-connected" role="status"><strong>{notice}</strong></div>}
    {error && <div className="status-banner status-banner-error" role="alert"><strong>{error}</strong></div>}
    {!accessToken ? <div className="setup-panel"><div className="setup-index">01</div><div className="setup-copy"><span className="eyebrow">SECURE ACCESS</span><h2>{oidcConfigured ? 'Sign in to manage accounts' : 'Connect the Drixel identity provider'}</h2><p>{oidcConfigured ? 'Sign-in uses OpenID Connect authorization code flow with PKCE. Account and invitation data is returned only after the API verifies your identity and business role.' : 'Add the OIDC client settings to the frontend and API environment to enable secure sign-in.'}</p><ul><li>One verified identity can hold separate memberships across Drixel businesses.</li><li>Business administrators can manage accounts only within their assigned business.</li><li>Invitation links are single-use, email-bound, and expire after seven days.</li></ul><div className="setup-actions">{oidcConfigured ? <button className="button button-primary" type="button" onClick={onSignIn}>Sign in with Drixel ID</button> : <button className="button button-primary" type="button" onClick={() => onNavigate('Settings')}>Review identity setup</button>}<span>Passwords stay with the identity provider.</span></div></div></div> : <>
      <section className="content-panel settings-section">
        <div className="panel-heading"><div><h2>Invite a person</h2><p>Create an invitation for one business. The person must sign in with the invited verified email.</p></div></div>
        <form className="invite-form" onSubmit={createInvitation}>
          <label>Full name<input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" /></label>
          <label>Work email<input required type="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
          <label>Business<select required value={organizationId} onChange={(event) => { setOrganizationId(event.target.value); setApplicationId(''); setRoleCode('employee'); setMembershipKind('employee') }}><option value="">Choose a business</option>{businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}</select></label>
          <label>Service access<select value={applicationId} onChange={(event) => { const id = event.target.value; setApplicationId(id); setRoleCode(id ? 'end_user' : 'employee'); setMembershipKind(id ? 'customer' : 'employee') }}><option value="">Business membership only</option>{availableServices.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label>
          <label>Membership<select value={membershipKind} onChange={(event) => setMembershipKind(event.target.value)}><option value="employee">Employee</option><option value="contractor">Contractor</option><option value="partner">Partner</option><option value="customer">Customer user</option></select></label>
          <label>{applicationId ? 'Service role' : 'Business role'}<select value={roleCode} onChange={(event) => setRoleCode(event.target.value)}>{applicationId ? <><option value="end_user">End user</option><option value="support_agent">Support agent</option><option value="app_admin">Application administrator</option></> : <><option value="employee">Employee</option><option value="manager">Manager</option>{canAssignBusinessAdmin && <option value="business_admin">Business administrator</option>}</>}</select></label>
          <div className="invite-submit"><button className="button button-primary" type="submit" disabled={saving || !organizationId}>{saving ? 'Creating invitation…' : 'Create invitation'}</button></div>
        </form>
        {inviteLink && <div className="invite-link-panel"><strong>One-time invitation link</strong><input aria-label="One-time invitation link" readOnly value={inviteLink} onFocus={(event) => event.currentTarget.select()} /><button type="button" className="button button-secondary" onClick={() => void navigator.clipboard.writeText(inviteLink).then(() => setNotice('Invitation link copied. Send it only to the invited person.')).catch(() => setNotice('Select and copy the invitation link.'))}>Copy link</button></div>}
      </section>
      <section className="content-panel">
        <div className="panel-heading"><div><h2>Business accounts</h2><p>{loading ? 'Loading authorized accounts…' : `${accounts.length} account memberships visible in your authorized scope.`}</p></div></div>
        <div className="table-scroll"><table className="data-table account-table"><thead><tr><th>PERSON</th><th>EMAIL</th><th>BUSINESS</th><th>SERVICE</th><th>MEMBERSHIP</th><th>ROLE</th><th>STATUS</th><th>ACCESS</th></tr></thead><tbody>{accounts.map((account, index) => {
          const key = accountAccessKey(account)
          const draft = accessDrafts[key] ?? { role_code: account.role_code ?? (account.application_id ? 'end_user' : 'employee'), membership_status: account.membership_status === 'suspended' ? 'suspended' as const : 'active' as const }
          const pending = account.membership_status === 'invited'
          return <tr key={`${account.id}-${account.organization_id}-${account.application_id ?? 'business'}-${index}`}>
            <td><strong className="table-primary">{account.display_name}</strong></td>
            <td>{account.email ?? 'No primary email'}</td>
            <td>{account.organization_name}</td>
            <td>{account.service_name ?? 'All business'}</td>
            <td>{statusLabel(account.membership_kind)}</td>
            <td>{account.role_code ? account.role_code.replaceAll('_', ' ') : 'Pending invitation'}</td>
            <td><span className={`status-tag ${account.membership_status === 'active' ? '' : 'status-tag-muted'}`}>{statusLabel(account.membership_status)}</span></td>
            <td className="account-access-cell">{pending ? <span className="directory-toolbar-note">Awaiting sign-in</span> : <>
              <select aria-label={`Role for ${account.display_name} in ${account.service_name ?? account.organization_name}`} value={draft.role_code} onChange={(event) => setAccessDrafts((current) => ({ ...current, [key]: { ...draft, role_code: event.target.value } }))}>
                {account.application_id ? <><option value="end_user">End user</option><option value="support_agent">Support agent</option><option value="app_admin">Application administrator</option></> : <><option value="employee">Employee</option><option value="manager">Manager</option>{canAssignBusinessAdmin && <option value="business_admin">Business administrator</option>}</>}
              </select>
              <select aria-label={`Membership status for ${account.display_name}`} value={draft.membership_status} onChange={(event) => setAccessDrafts((current) => ({ ...current, [key]: { ...draft, membership_status: event.target.value as AccountAccessDraft['membership_status'] } }))}>
                <option value="active">Active</option><option value="suspended">Suspended</option>
              </select>
              <button className="button button-secondary" type="button" disabled={savingAccessKey === key || !accessToken} onClick={() => void saveAccountAccess(account)}>{savingAccessKey === key ? 'Saving…' : 'Save access'}</button>
            </>}</td>
          </tr>
        })}{!loading && accounts.length === 0 && <tr><td colSpan={8} className="empty-table">No accounts are assigned to businesses within your authorized scope.</td></tr>}</tbody></table></div>
      </section>
      <footer className="page-footer">Access to this page is checked by the API against your verified identity and scoped administrator role.</footer>
    </>}
  </>
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

type AuditEvent = { id: number; action: string; target_type: string; target_id: string; occurred_at: string; actor_name: string | null; organization_name: string | null }

function AuditPage({ accessToken, onSignIn }: { accessToken?: string; onSignIn: () => void }) {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!accessToken) return
    const controller = new AbortController()
    setLoading(true)
    fetch('/api/audit-log', { headers: { Authorization: `Bearer ${accessToken}` }, signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as { events?: AuditEvent[]; error?: string }
        if (!response.ok) throw new Error(body.error ?? 'Audit log is unavailable')
        setEvents(body.events ?? [])
        setError('')
      }).catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return
        setError(reason instanceof Error ? reason.message : 'Audit log is unavailable')
      }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [accessToken])
  return <><PageHeading eyebrow="GOVERNANCE" title="Audit log" description="Review recent account and access changes within your authorized business scope." />{!accessToken ? <div className="empty-state"><div className="empty-state-title">Sign in to view audit events</div><p>Audit records are restricted to authorized Drixel administrators.</p><button className="button button-primary" onClick={onSignIn} disabled={!oidcConfigured}>Sign in</button></div> : <section className="content-panel"><div className="panel-heading"><div><h2>Recent events</h2><p>{loading ? 'Loading audit history…' : `Showing ${events.length} most recent events in your scope.`}</p></div></div>{error && <div className="status-banner status-banner-error" role="alert"><strong>{error}</strong></div>}<div className="table-scroll"><table className="data-table"><thead><tr><th>WHEN</th><th>EVENT</th><th>ACTOR</th><th>BUSINESS</th><th>RECORD</th></tr></thead><tbody>{events.map((event) => <tr key={event.id}><td>{new Date(event.occurred_at).toLocaleString()}</td><td><strong className="table-primary">{event.action}</strong></td><td>{event.actor_name ?? 'System'}</td><td>{event.organization_name ?? 'Group'}</td><td>{event.target_type} · {event.target_id}</td></tr>)}{!loading && events.length === 0 && <tr><td colSpan={5} className="empty-table">No audit events are recorded in your authorized scope.</td></tr>}</tbody></table></div></section>}</>
}

function SettingsPage({ businessCount, serviceCount, directoryConnected, authSubject }: { businessCount: number; serviceCount: number; directoryConnected: boolean; authSubject: string }) {
  return <><PageHeading eyebrow="CONFIGURATION" title="Settings" description="Configure the shared identity and group directory services." /><section className="content-panel settings-section"><div className="panel-heading"><div><h2>Identity provider</h2><p>Single sign-on and account verification.</p></div><span className={`status-tag ${oidcConfigured ? '' : 'status-tag-muted'}`}>{oidcConfigured ? 'Configured' : 'Not connected'}</span></div><div className="settings-row"><div><strong>Provider</strong><span>{oidcConfigured ? oidcConfig.issuer : 'Not configured'}</span></div><div><strong>Protocol</strong><span>OpenID Connect with PKCE</span></div><div><strong>Administrator MFA</strong><span>Enforce in the identity provider</span></div></div>{authSubject && <div className="settings-note"><strong>Auth0 User ID</strong><br /><code>{authSubject}</code><br />Copy this value for the one-time Group Owner setup.</div>}<div className="settings-note">Configure the issuer, API audience, JWKS URI, public client ID, authorization endpoint, and token endpoint in the local environment. Register the exact callback URL shown in the README.</div></section><section className="content-panel settings-section"><div className="panel-heading"><div><h2>Group directory</h2><p>Business and service registry in PostgreSQL.</p></div><span className={`status-tag ${directoryConnected ? '' : 'status-tag-muted'}`}>{directoryConnected ? 'Connected' : 'Unavailable'}</span></div><div className="settings-row"><div><strong>Parent organization</strong><span>Drixel Labs Inc</span></div><div><strong>Business units</strong><span>{directoryConnected ? `${businessCount} registered` : 'Unavailable'}</span></div><div><strong>Services</strong><span>{directoryConnected ? `${serviceCount} registered` : 'Unavailable'}</span></div></div></section><section className="content-panel settings-section"><div className="panel-heading"><div><h2>Security boundaries</h2><p>Current database controls.</p></div></div><ul className="security-list"><li>The portfolio API remains on a dedicated read-only database role.</li><li>Account management uses a separate server-only database credential and checks OIDC issuer, audience, and scoped roles.</li><li>Account passwords are never stored in this platform.</li></ul></section><footer className="page-footer">Never expose the management database credential in frontend variables or source code.</footer></>
}

export default App
