import fs from 'node:fs'

const appPath = 'src/App.tsx'
let app = fs.readFileSync(appPath, 'utf8')
app = app.replace(
  `import { Button, EmptyState, PageHeader, SectionCard, SectionHeader, StatStrip, StatusPill, TableRowLink } from './components/admin/ui'`,
  `import { Button, CopyField, EmptyState, PageHeader, SectionCard, SectionHeader, Skeleton, StatStrip, StatusPill, TableRowLink } from './components/admin/ui'`,
)

const accountsReturnStart = app.indexOf('  return <>\n    <PageHeading eyebrow="IDENTITY" title="Accounts"')
const rolesStart = app.indexOf('\nfunction RolesPage()', accountsReturnStart)
if (accountsReturnStart < 0 || rolesStart < 0) throw new Error('Accounts render block not found')
const accountsReturn = `  return <div className="space-y-8">
    <PageHeader eyebrow="Identity" title="Accounts" description="Invite people and manage access across Drixel businesses and services." />

    {(authError || error || notice) && <div className={\`rounded-[var(--radius-card)] border px-4 py-3 text-[13px] \${authError || error ? 'border-danger/20 bg-danger-bg text-danger' : 'border-success/20 bg-success-bg text-success'}\`} role={authError || error ? 'alert' : 'status'}>{authError || error || notice}</div>}

    {!accessToken ? <SectionCard>
      <div className="flex min-h-[320px] flex-col items-center justify-center px-6 py-12 text-center">
        <div className="mb-5 grid h-12 w-12 place-items-center rounded-full bg-surface-subtle text-accent"><span className="text-[16px] font-semibold">ID</span></div>
        <h2 className="text-[20px] font-semibold tracking-[-.02em] text-foreground">{oidcConfigured ? 'Sign in to manage accounts' : 'Connect Drixel ID'}</h2>
        <p className="mt-3 max-w-lg text-[14px] leading-6 text-muted-foreground">{oidcConfigured ? 'Account data and invitations are available only after the management API verifies your identity and administrator scope.' : 'Identity settings must be configured before account administration can be used.'}</p>
        <div className="mt-6"><Button variant="primary" onClick={oidcConfigured ? onSignIn : () => onNavigate('Settings')}>{oidcConfigured ? 'Sign in with Drixel ID' : 'Review identity settings'}</Button></div>
        <p className="mt-4 text-[12px] text-tertiary-foreground">Passwords remain with the identity provider.</p>
      </div>
    </SectionCard> : <>
      <SectionCard>
        <SectionHeader title="Invite a person" description="Create access for one business or service. Invitations expire after seven days." />
        <form className="grid gap-5 p-5 md:grid-cols-2 xl:grid-cols-3" onSubmit={createInvitation}>
          <label className="space-y-2"><span className="text-[12px] font-medium text-muted-foreground">Full name</span><input className="h-10 w-full rounded-[var(--radius-control)] border border-border-strong bg-surface px-3 text-[13px]" required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" /></label>
          <label className="space-y-2"><span className="text-[12px] font-medium text-muted-foreground">Work email</span><input className="h-10 w-full rounded-[var(--radius-control)] border border-border-strong bg-surface px-3 text-[13px]" required type="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
          <label className="space-y-2"><span className="text-[12px] font-medium text-muted-foreground">Business</span><select className="h-10 w-full rounded-[var(--radius-control)] border border-border-strong bg-surface px-3 text-[13px]" required value={organizationId} onChange={(event) => { setOrganizationId(event.target.value); setApplicationId(''); setRoleCode('employee'); setMembershipKind('employee') }}><option value="">Choose a business</option>{businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}</select></label>
          <label className="space-y-2"><span className="text-[12px] font-medium text-muted-foreground">Service access</span><select className="h-10 w-full rounded-[var(--radius-control)] border border-border-strong bg-surface px-3 text-[13px]" value={applicationId} onChange={(event) => { const id = event.target.value; setApplicationId(id); setRoleCode(id ? 'end_user' : 'employee'); setMembershipKind(id ? 'customer' : 'employee') }}><option value="">Business membership only</option>{availableServices.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label>
          <label className="space-y-2"><span className="text-[12px] font-medium text-muted-foreground">Membership</span><select className="h-10 w-full rounded-[var(--radius-control)] border border-border-strong bg-surface px-3 text-[13px]" value={membershipKind} onChange={(event) => setMembershipKind(event.target.value)}><option value="employee">Employee</option><option value="contractor">Contractor</option><option value="partner">Partner</option><option value="customer">Customer user</option></select></label>
          <label className="space-y-2"><span className="text-[12px] font-medium text-muted-foreground">{applicationId ? 'Service role' : 'Business role'}</span><select className="h-10 w-full rounded-[var(--radius-control)] border border-border-strong bg-surface px-3 text-[13px]" value={roleCode} onChange={(event) => setRoleCode(event.target.value)}>{applicationId ? <><option value="end_user">End user</option><option value="support_agent">Support agent</option><option value="app_admin">Application administrator</option></> : <><option value="employee">Employee</option><option value="manager">Manager</option>{canAssignBusinessAdmin && <option value="business_admin">Business administrator</option>}</>}</select></label>
          <div className="flex items-end md:col-span-2 xl:col-span-3"><Button variant="primary" type="submit" disabled={saving || !organizationId}>{saving ? 'Creating invitation…' : 'Create invitation'}</Button></div>
        </form>
        {inviteLink && <div className="border-t border-border p-5"><CopyField label="One-time invitation link" value={inviteLink} /></div>}
      </SectionCard>

      <SectionCard>
        <SectionHeader title="People and access" description={loading ? 'Loading authorized accounts…' : accounts.length + ' memberships visible in your administrator scope.'} />
        {loading ? <div className="space-y-0 divide-y divide-border">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="grid gap-4 px-5 py-5 md:grid-cols-[minmax(0,1fr)_minmax(180px,.8fr)_auto]"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-10 w-full" /><Skeleton className="h-9 w-28" /></div>)}</div> : accounts.length ? <div className="divide-y divide-border">{accounts.map((account, index) => {
          const key = accountAccessKey(account)
          const draft = accessDrafts[key] ?? { role_code: account.role_code ?? (account.application_id ? 'end_user' : 'employee'), membership_status: account.membership_status === 'suspended' ? 'suspended' as const : 'active' as const }
          const pending = account.membership_status === 'invited'
          return <div key={account.id + '-' + account.organization_id + '-' + (account.application_id ?? 'business') + '-' + index} className="grid gap-4 px-5 py-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(220px,.8fr)_minmax(280px,1fr)] lg:items-center">
            <div className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-subtle text-[12px] font-semibold text-muted-foreground">{account.display_name.slice(0, 2).toUpperCase()}</span><div className="min-w-0"><p className="truncate text-[14px] font-medium text-foreground">{account.display_name}</p><p className="mt-0.5 truncate text-[12px] text-muted-foreground">{account.email ?? 'No primary email'}</p></div></div>
            <div className="min-w-0"><p className="truncate text-[13px] text-foreground">{account.service_name ?? account.organization_name}</p><div className="mt-2 flex flex-wrap gap-2"><StatusPill status={account.membership_status === 'active' ? 'active' : account.membership_status === 'suspended' ? 'warning' : 'muted'} label={statusLabel(account.membership_status)} /><span className="inline-flex h-6 items-center rounded-full bg-surface-subtle px-2.5 text-[12px] text-muted-foreground">{statusLabel(account.membership_kind)}</span></div></div>
            {pending ? <p className="text-[12px] text-muted-foreground">Awaiting first sign-in</p> : <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_130px_auto]"><select aria-label={'Role for ' + account.display_name} className="h-9 min-w-0 rounded-[var(--radius-control)] border border-border bg-surface px-2.5 text-[12px]" value={draft.role_code} onChange={(event) => setAccessDrafts((current) => ({ ...current, [key]: { ...draft, role_code: event.target.value } }))}>{account.application_id ? <><option value="end_user">End user</option><option value="support_agent">Support agent</option><option value="app_admin">Application administrator</option></> : <><option value="employee">Employee</option><option value="manager">Manager</option>{canAssignBusinessAdmin && <option value="business_admin">Business administrator</option>}</>}</select><select aria-label={'Membership status for ' + account.display_name} className="h-9 rounded-[var(--radius-control)] border border-border bg-surface px-2.5 text-[12px]" value={draft.membership_status} onChange={(event) => setAccessDrafts((current) => ({ ...current, [key]: { ...draft, membership_status: event.target.value as AccountAccessDraft['membership_status'] } }))}><option value="active">Active</option><option value="suspended">Suspended</option></select><Button variant="secondary" type="button" disabled={savingAccessKey === key || !accessToken} onClick={() => void saveAccountAccess(account)}>{savingAccessKey === key ? 'Saving…' : 'Save'}</Button></div>}
          </div>
        })}</div> : <EmptyState title="No accounts yet" description="Invite someone to a business or service and their access will appear here." />}
      </SectionCard>
      <p className="text-[12px] text-tertiary-foreground">Account access is enforced by the API using your verified identity and administrator scope.</p>
    </>}
  </div>
}
`
app = app.slice(0, accountsReturnStart) + accountsReturn + app.slice(rolesStart)

const rolesBlockStart = app.indexOf('function RolesPage()')
const auditTypeStart = app.indexOf('\ntype AuditEvent', rolesBlockStart)
if (rolesBlockStart < 0 || auditTypeStart < 0) throw new Error('Roles block not found')
const roles = `function RolesPage() {
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
  const groups = ['Group', 'Business', 'Service', 'Customer workspace']
  return <div className="space-y-8"><PageHeader eyebrow="Access control" title="Access roles" description="Understand what each role can do and where that permission applies." />
    <SectionCard><SectionHeader title="Role catalogue" description="Permissions are always scoped to a group, business, service, or customer workspace." action={<span className="text-[12px] font-medium text-muted-foreground">10 roles</span>} />
      <div className="grid gap-0 lg:grid-cols-2">{groups.map((scope) => <div key={scope} className="border-b border-border p-5 lg:[&:nth-child(odd)]:border-r"><div className="mb-4 flex items-center justify-between"><h3 className="text-[14px] font-semibold text-foreground">{scope}</h3><span className="rounded-full bg-surface-subtle px-2.5 py-1 text-[11px] font-medium text-muted-foreground">{roleRows.filter((row) => row[1] === scope).length}</span></div><div className="space-y-1">{roleRows.filter((row) => row[1] === scope).map(([name, , description]) => <div key={name} className="rounded-[var(--radius-control)] px-3 py-3 hover:bg-surface-hover"><p className="text-[13px] font-medium text-foreground">{name}</p><p className="mt-1 text-[12px] leading-5 text-muted-foreground">{description}</p></div>)}</div></div>)}</div>
    </SectionCard>
    <div className="rounded-[var(--radius-card)] bg-surface-subtle px-5 py-4"><p className="text-[13px] font-medium text-foreground">Access stays inside its scope.</p><p className="mt-1 text-[12px] leading-5 text-muted-foreground">Membership in one business does not grant access to another Drixel business or its customer data.</p></div>
  </div>
}
`
app = app.slice(0, rolesBlockStart) + roles + app.slice(auditTypeStart)

const auditStart = app.indexOf('function AuditPage(')
const settingsStart = app.indexOf('\nfunction SettingsPage(', auditStart)
if (auditStart < 0 || settingsStart < 0) throw new Error('Audit block not found')
const audit = `function AuditPage({ accessToken, onSignIn }: { accessToken?: string; onSignIn: () => void }) {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!accessToken) return
    const controller = new AbortController()
    setLoading(true)
    fetch('/api/audit-log', { headers: { Authorization: \`Bearer \${accessToken}\` }, signal: controller.signal })
      .then(async (response) => { const body = await response.json() as { events?: AuditEvent[]; error?: string }; if (!response.ok) throw new Error(body.error ?? 'Audit log is unavailable'); setEvents(body.events ?? []); setError('') })
      .catch((reason: unknown) => { if (reason instanceof DOMException && reason.name === 'AbortError') return; setError(reason instanceof Error ? reason.message : 'Audit log is unavailable') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [accessToken])
  return <div className="space-y-8"><PageHeader eyebrow="Governance" title="Audit log" description="Review recent account, access, and administration changes in your authorized scope." />
    {!accessToken ? <SectionCard><EmptyState title="Sign in to view audit events" description="Audit records are restricted to authorized Drixel administrators." action={<Button variant="primary" onClick={onSignIn} disabled={!oidcConfigured}>Sign in</Button>} /></SectionCard> : <SectionCard>
      <SectionHeader title="Recent activity" description={loading ? 'Loading audit history…' : events.length + ' recent events in your scope.'} />
      {error && <div className="m-5 rounded-[var(--radius-control)] bg-danger-bg px-4 py-3 text-[13px] text-danger" role="alert">{error}</div>}
      {loading ? <div className="divide-y divide-border">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="grid gap-3 px-5 py-4 md:grid-cols-[160px_minmax(0,1fr)_180px]"><Skeleton className="h-4 w-28" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-28" /></div>)}</div> : events.length ? <div className="divide-y divide-border">{events.map((event) => <div key={event.id} className="grid gap-3 px-5 py-4 md:grid-cols-[170px_minmax(0,1fr)_200px] md:items-center"><time className="text-[12px] text-muted-foreground">{new Date(event.occurred_at).toLocaleString()}</time><div className="min-w-0"><p className="truncate text-[13px] font-medium text-foreground">{event.action}</p><p className="mt-1 truncate text-[12px] text-tertiary-foreground">{event.target_type} · {event.target_id}</p></div><div className="text-[12px] text-muted-foreground"><p className="truncate">{event.actor_name ?? 'System'}</p><p className="mt-1 truncate text-tertiary-foreground">{event.organization_name ?? 'Group'}</p></div></div>)}</div> : <EmptyState title="No audit activity" description="Changes made within your authorized scope will appear here." />}
    </SectionCard>}
  </div>
}
`
app = app.slice(0, auditStart) + audit + app.slice(settingsStart)

const settingsBlockStart = app.indexOf('function SettingsPage(')
const exportStart = app.indexOf('\nexport default App', settingsBlockStart)
if (settingsBlockStart < 0 || exportStart < 0) throw new Error('Settings block not found')
const settings = `function SettingsPage({ businessCount, serviceCount, directoryConnected, authSubject }: { businessCount: number; serviceCount: number; directoryConnected: boolean; authSubject: string }) {
  const [section, setSection] = useState<'identity' | 'directory' | 'security'>('identity')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  return <div className="space-y-8"><PageHeader eyebrow="Configuration" title="Settings" description="Manage identity, directory health, and security boundaries for Drixel Labs." />
    <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
      <nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label="Settings sections">{([['identity','Identity'],['directory','Directory'],['security','Security']] as const).map(([key,label]) => <button key={key} type="button" onClick={() => setSection(key)} className={\`whitespace-nowrap rounded-[var(--radius-control)] px-3 py-2 text-left text-[13px] font-medium \${section === key ? 'bg-[var(--sidebar-active)] text-accent' : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground'}\`}>{label}</button>)}</nav>
      <div>
        {section === 'identity' && <SectionCard><SectionHeader title="Identity" description="Drixel ID verifies administrators before account and access data is returned." action={<StatusPill status={oidcConfigured ? 'healthy' : 'warning'} label={oidcConfigured ? 'Connected' : 'Setup needed'} />} />
          <div className="divide-y divide-border"><div className="grid gap-3 px-5 py-5 sm:grid-cols-[180px_minmax(0,1fr)]"><span className="text-[12px] font-medium text-muted-foreground">Provider</span><span className="text-[13px] text-foreground">{oidcConfigured ? 'Auth0' : 'Not configured'}</span></div><div className="grid gap-3 px-5 py-5 sm:grid-cols-[180px_minmax(0,1fr)]"><span className="text-[12px] font-medium text-muted-foreground">Protocol</span><span className="text-[13px] text-foreground">OpenID Connect with PKCE</span></div><div className="grid gap-3 px-5 py-5 sm:grid-cols-[180px_minmax(0,1fr)]"><span className="text-[12px] font-medium text-muted-foreground">Administrator MFA</span><span className="text-[13px] text-foreground">Managed by the identity provider</span></div></div>
          <div className="border-t border-border p-5"><button type="button" onClick={() => setAdvancedOpen((value) => !value)} className="flex w-full items-center justify-between text-left text-[13px] font-medium text-foreground"><span>Advanced</span><span className="text-muted-foreground">{advancedOpen ? 'Hide' : 'Show'}</span></button>{advancedOpen && <div className="mt-5 grid gap-3">{oidcConfig.issuer && <CopyField label="Issuer" value={oidcConfig.issuer} />}{oidcConfig.audience && <CopyField label="API audience" value={oidcConfig.audience} />}{oidcConfig.clientId && <CopyField label="Public client ID" value={oidcConfig.clientId} />}{oidcConfig.authorizationEndpoint && <CopyField label="Authorization endpoint" value={oidcConfig.authorizationEndpoint} />}{oidcConfig.tokenEndpoint && <CopyField label="Token endpoint" value={oidcConfig.tokenEndpoint} />}{authSubject && <CopyField label="Auth0 user ID" value={authSubject} />}</div>}</div>
        </SectionCard>}
        {section === 'directory' && <SectionCard><SectionHeader title="Directory" description="Businesses and services registered in the Drixel group directory." action={<StatusPill status={directoryConnected ? 'healthy' : 'error'} label={directoryConnected ? 'Connected' : 'Unavailable'} />} /><div className="grid sm:grid-cols-3"><div className="p-5"><p className="text-[12px] text-muted-foreground">Parent organization</p><p className="mt-2 text-[14px] font-medium text-foreground">Drixel Labs Inc</p></div><div className="border-t border-border p-5 sm:border-l sm:border-t-0"><p className="text-[12px] text-muted-foreground">Businesses</p><p className="numeral mt-2 text-[24px] font-semibold text-foreground">{directoryConnected ? businessCount : '—'}</p></div><div className="border-t border-border p-5 sm:border-l sm:border-t-0"><p className="text-[12px] text-muted-foreground">Services</p><p className="numeral mt-2 text-[24px] font-semibold text-foreground">{directoryConnected ? serviceCount : '—'}</p></div></div></SectionCard>}
        {section === 'security' && <SectionCard><SectionHeader title="Security" description="Security boundaries that remain enforced regardless of the interface." /><div className="divide-y divide-border"><div className="px-5 py-5"><p className="text-[13px] font-medium text-foreground">Read-only portfolio access</p><p className="mt-1 text-[12px] leading-5 text-muted-foreground">The portfolio API continues to use a dedicated read-only database role.</p></div><div className="px-5 py-5"><p className="text-[13px] font-medium text-foreground">Server-only management credentials</p><p className="mt-1 text-[12px] leading-5 text-muted-foreground">Account-management database credentials remain on the server and are never exposed through frontend variables.</p></div><div className="px-5 py-5"><p className="text-[13px] font-medium text-foreground">External passwords</p><p className="mt-1 text-[12px] leading-5 text-muted-foreground">Drixel does not store account passwords. Authentication remains with the configured identity provider.</p></div></div></SectionCard>}
      </div>
    </div>
    <p className="text-[12px] text-tertiary-foreground">Never expose management database credentials or signing secrets in client code.</p>
  </div>
}
`
app = app.slice(0, settingsBlockStart) + settings + app.slice(exportStart)
fs.writeFileSync(appPath, app)

const shellPath = 'src/components/admin/AdminShell.tsx'
let shell = fs.readFileSync(shellPath, 'utf8')
shell = shell.replace('LogIn, LogOut, Menu, Search, ScrollText, Settings, ShieldCheck, Users, X, type LucideIcon', 'LogIn, LogOut, Menu, Moon, Search, ScrollText, Settings, ShieldCheck, Sun, Users, X, type LucideIcon')
shell = shell.replace('  const [commandOpen, setCommandOpen] = useState(false)', `  const [commandOpen, setCommandOpen] = useState(false)\n  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('drixel-theme') === 'dark' || (!localStorage.getItem('drixel-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches))`)
shell = shell.replace('  useEffect(() => {\n    const onKey', `  useEffect(() => {\n    document.documentElement.classList.toggle('dark', darkMode)\n    localStorage.setItem('drixel-theme', darkMode ? 'dark' : 'light')\n  }, [darkMode])\n\n  useEffect(() => {\n    const onKey`)
const settingsItem = `<DropdownMenu.Item onSelect={onSettings} className="flex h-9 cursor-pointer items-center gap-2 rounded-md px-2.5 text-[12px] text-foreground outline-none hover:bg-surface-hover focus:bg-surface-hover"><Settings size={15} />Settings</DropdownMenu.Item>`
shell = shell.replace(settingsItem, settingsItem + `<DropdownMenu.Item onSelect={(event) => { event.preventDefault(); setDarkMode((value) => !value) }} className="flex h-9 cursor-pointer items-center gap-2 rounded-md px-2.5 text-[12px] text-foreground outline-none hover:bg-surface-hover focus:bg-surface-hover">{darkMode ? <Sun size={15} /> : <Moon size={15} />}{darkMode ? 'Use light appearance' : 'Use dark appearance'}</DropdownMenu.Item>`)
fs.writeFileSync(shellPath, shell)
