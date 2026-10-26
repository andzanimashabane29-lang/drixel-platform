import fs from 'node:fs'

const path = 'src/App.tsx'
let text = fs.readFileSync(path, 'utf8')

function replaceOnce(from, to, label) {
  const first = text.indexOf(from)
  if (first < 0) throw new Error(`Missing ${label}`)
  if (text.indexOf(from, first + from.length) >= 0) throw new Error(`Multiple ${label}`)
  text = text.slice(0, first) + to + text.slice(first + from.length)
}

replaceOnce(
  `import { useEffect, useMemo, useState, type FormEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'\n`,
  `import { useEffect, useMemo, useState, type FormEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'\nimport { AdminShell } from './components/admin/AdminShell'\nimport { Button, EmptyState, PageHeader, SectionCard, SectionHeader, Skeleton, StatStrip, StatusPill } from './components/admin/ui'\n`,
  'App imports',
)

text = text.replace(`  const [mobileNavOpen, setMobileNavOpen] = useState(false)\n`, '')
text = text.replace(`      setMobileNavOpen(false)\n`, '')
text = text.replace(`    setMobileNavOpen(false)\n`, '')

const escapeEffect = `  useEffect(() => {\n    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMobileNavOpen(false) }\n    window.addEventListener('keydown', closeOnEscape)\n    return () => window.removeEventListener('keydown', closeOnEscape)\n  }, [])\n\n`
text = text.replace(escapeEffect, '')

const shellStart = text.indexOf(`  return (\n    <div className="app-shell">`)
const shellEndMarker = `\n}\n\nfunction PageHeading`
const shellEnd = text.indexOf(shellEndMarker, shellStart)
if (shellStart < 0 || shellEnd < 0) throw new Error('Could not locate App shell')

const replacement = `  const navItems = sections.map((item) => ({\n    label: item,\n    href: sectionPaths[item],\n    active: section === item,\n    onClick: () => selectSection(item),\n  }))\n  const breadcrumbs = route.slug\n    ? [\n        { label: 'Drixel Labs Inc', onClick: () => selectSection('Overview') },\n        { label: section, onClick: () => selectSection(section) },\n        { label: selectedBusiness?.name ?? selectedService?.name ?? route.slug },\n      ]\n    : [{ label: 'Drixel Labs Inc', onClick: () => selectSection('Overview') }, { label: section }]\n\n  const signOut = () => {\n    setAccessToken(undefined)\n    setIdToken(undefined)\n    sessionStorage.removeItem('drixel-access-token')\n    sessionStorage.removeItem('drixel-id-token')\n    setAuthError('')\n  }\n  const signIn = () => {\n    if (oidcConfigured) void beginOidcLogin().catch(() => setAuthError('Could not start secure sign-in.'))\n    else selectSection('Settings')\n  }\n\n  return (\n    <AdminShell\n      items={navItems}\n      breadcrumbs={breadcrumbs}\n      search={showSearch ? { value: query, placeholder: section === 'Businesses' ? 'Search businesses' : section === 'Services' ? 'Search services' : 'Search portfolio', onChange: setQuery } : undefined}\n      authenticated={Boolean(accessToken)}\n      oidcConfigured={oidcConfigured}\n      onSignIn={signIn}\n      onSignOut={signOut}\n      onSettings={() => selectSection('Settings')}\n    >\n      {section === 'Overview' && <Overview onNavigate={selectSection} onOpenBusiness={openBusiness} onOpenService={openService} onRetry={() => setDirectoryRefresh((value) => value + 1)} filteredBusinesses={filteredBusinesses} filteredServices={filteredServices} businessCount={businesses.length} activeBusinessCount={activeBusinessCount} serviceCount={services.length} activeServiceCount={activeServiceCount} loading={directoryLoading} error={directoryError} />}\n      {section === 'Businesses' && (route.slug\n        ? <BusinessDetailPage business={selectedBusiness} services={services.filter((service) => service.owner_slug === route.slug)} loading={directoryLoading} error={directoryError} onRetry={() => setDirectoryRefresh((value) => value + 1)} onBack={() => selectSection('Businesses')} onOpenService={openService} onNavigate={selectSection} />\n        : <BusinessesPage rows={filteredBusinesses} totalCount={businesses.length} loading={directoryLoading} error={directoryError} onRetry={() => setDirectoryRefresh((value) => value + 1)} onOpenBusiness={openBusiness} accessToken={accessToken} onPortfolioChanged={() => setDirectoryRefresh((value) => value + 1)} />)}\n      {section === 'Services' && (route.slug\n        ? <ServiceDetailPage service={selectedService} loading={directoryLoading} error={directoryError} onRetry={() => setDirectoryRefresh((value) => value + 1)} onBack={() => selectSection('Services')} onOpenBusiness={openBusiness} />\n        : <ServicesPage rows={filteredServices} totalCount={services.length} loading={directoryLoading} error={directoryError} onRetry={() => setDirectoryRefresh((value) => value + 1)} onOpenService={openService} onOpenBusiness={openBusiness} accessToken={accessToken} groupBusinesses={businesses} onPortfolioChanged={() => setDirectoryRefresh((value) => value + 1)} />)}\n      {section === 'Accounts' && <AccountsPage onNavigate={selectSection} accessToken={accessToken} idToken={idToken} businesses={businesses} services={services} acceptToken={route.acceptToken} onSignIn={signIn} authError={authError} />}\n      {section === 'Access roles' && <RolesPage />}\n      {section === 'Audit log' && <AuditPage accessToken={accessToken} onSignIn={signIn} />}\n      {section === 'Settings' && <SettingsPage businessCount={businesses.length} serviceCount={services.length} directoryConnected={!directoryLoading && !directoryError} authSubject={idToken ? String(readJwtPayload(idToken).sub ?? '') : ''} />}\n    </AdminShell>\n  )`

text = text.slice(0, shellStart) + replacement + text.slice(shellEnd)

replaceOnce(
`function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {\n  return (\n    <div className="page-heading">\n      <div>\n        <div className="eyebrow">{eyebrow}</div>\n        <h1>{title}</h1>\n        <p>{description}</p>\n      </div>\n      {action && <div className="heading-action">{action}</div>}\n    </div>\n  )\n}\n`,
`function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {\n  return <PageHeader eyebrow={eyebrow} title={title} description={description} action={action} />\n}\n`,
'PageHeading',
)

fs.writeFileSync(path, text)
