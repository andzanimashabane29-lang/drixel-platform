import fs from 'node:fs'

const path = 'src/App.tsx'
let text = fs.readFileSync(path, 'utf8')
const start = text.indexOf('function PortfolioManagementPanel(')
const end = text.indexOf('\nfunction BusinessesPage(', start)
if (start < 0 || end < 0) throw new Error('Portfolio management block not found')

const replacement = `function PortfolioManagementPanel({ type, businesses, services, accessToken, onSaved }: { type: 'business' | 'service'; businesses: Business[]; services: Service[]; accessToken?: string; onSaved: () => void }) {
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
    fetch('/api/portfolio/manage-access', { headers: { Authorization: 'Bearer ' + accessToken }, signal: controller.signal })
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
      const response = await fetch('/api/portfolio/' + (type === 'business' ? 'businesses' : 'services'), {
        method: 'POST', headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const body = await response.json() as { error?: string }
      if (!response.ok) throw new Error(body.error ?? 'Portfolio record could not be created')
      setName(''); setSlug(''); setOwnerId(''); setMessage((type === 'business' ? 'Business' : 'Service') + ' added to the group directory.')
      onSaved()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Portfolio record could not be created') }
    finally { setSaving(false) }
  }

  const updateRecord = async (id: string) => {
    setSavingId(id); setError(''); setMessage('')
    try {
      const response = await fetch('/api/portfolio/' + (type === 'business' ? 'businesses' : 'services') + '/' + encodeURIComponent(id), {
        method: 'PATCH', headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameDrafts[id], status: statusDrafts[id] }),
      })
      const body = await response.json() as { error?: string }
      if (!response.ok) throw new Error(body.error ?? 'Portfolio record could not be updated')
      setMessage('Changes saved and recorded in the audit log.')
      onSaved()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Portfolio record could not be updated') }
    finally { setSavingId('') }
  }

  const label = type === 'business' ? 'business' : 'service'
  const title = type === 'business' ? 'Manage businesses' : 'Manage services'
  const description = type === 'business' ? 'Add a business or update an existing operating unit.' : 'Add a service or update an existing product or shared service.'

  return <SectionCard className="mb-6">
    <SectionHeader title={title} description={description} action={<StatusPill status="active" label="Group admin" />} />
    <form className="grid gap-4 border-b border-border bg-surface-subtle/40 p-5 md:grid-cols-2 xl:grid-cols-4" onSubmit={createRecord}>
      <label className="space-y-2"><span className="text-[12px] font-medium text-muted-foreground">{type === 'business' ? 'Business name' : 'Service name'}</span><input className="h-10 w-full rounded-[var(--radius-control)] border border-border-strong bg-surface px-3 text-[13px] text-foreground outline-none placeholder:text-tertiary-foreground" required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder={type === 'business' ? 'Business name' : 'Service name'} /></label>
      <label className="space-y-2"><span className="text-[12px] font-medium text-muted-foreground">Directory slug</span><input className="h-10 w-full rounded-[var(--radius-control)] border border-border-strong bg-surface px-3 font-mono text-[12px] text-foreground outline-none" required maxLength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*" title="Use lowercase letters, numbers, and hyphens." value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="example-name" /></label>
      {type === 'business' ? <label className="space-y-2"><span className="text-[12px] font-medium text-muted-foreground">Business type</span><select className="h-10 w-full rounded-[var(--radius-control)] border border-border-strong bg-surface px-3 text-[13px] text-foreground" value={kind} onChange={(event) => setKind(event.target.value)}><option value="business_unit">Business unit</option><option value="subsidiary">Subsidiary</option></select></label> : <label className="space-y-2"><span className="text-[12px] font-medium text-muted-foreground">Owning business</span><select className="h-10 w-full rounded-[var(--radius-control)] border border-border-strong bg-surface px-3 text-[13px] text-foreground" required value={ownerId} onChange={(event) => setOwnerId(event.target.value)}><option value="">Choose a business</option>{businesses.filter((business) => business.status !== 'closed').map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}</select></label>}
      <div className="flex items-end"><Button variant="primary" type="submit" disabled={saving} className="w-full xl:w-auto">{saving ? 'Adding…' : 'Add ' + label}</Button></div>
    </form>
    {(message || error) && <div className={'mx-5 mt-5 rounded-[var(--radius-control)] px-4 py-3 text-[13px] ' + (error ? 'bg-danger-bg text-danger' : 'bg-success-bg text-success')} role={error ? 'alert' : 'status'}>{error || message}</div>}
    <div className="divide-y divide-border px-5 py-2">
      {rows.map((row) => {
        const draftStatus = statusDrafts[row.id] ?? row.status
        return <div key={row.id} className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_160px_auto] md:items-center">
          <div className="min-w-0"><label className="sr-only" htmlFor={type + '-name-' + row.id}>{label} name</label><input id={type + '-name-' + row.id} className="h-10 w-full rounded-[var(--radius-control)] border border-transparent bg-transparent px-2 text-[14px] font-medium text-foreground hover:border-border focus:border-border-strong focus:bg-surface" maxLength={120} value={nameDrafts[row.id] ?? row.name} onChange={(event) => setNameDrafts((current) => ({ ...current, [row.id]: event.target.value }))} /></div>
          <div className="flex items-center gap-2"><StatusPill status={draftStatus === 'active' ? 'active' : draftStatus === 'suspended' ? 'warning' : 'muted'} label={statusLabel(draftStatus)} /><label className="sr-only" htmlFor={type + '-status-' + row.id}>{label} status</label><select id={type + '-status-' + row.id} className="h-9 min-w-0 flex-1 rounded-[var(--radius-control)] border border-border bg-surface px-2 text-[12px] text-foreground" value={draftStatus} onChange={(event) => setStatusDrafts((current) => ({ ...current, [row.id]: event.target.value }))}><option value="active">Active</option><option value="suspended">Suspended</option><option value="closed">Closed</option></select></div>
          <Button variant="secondary" type="button" disabled={savingId === row.id || !nameDrafts[row.id]?.trim()} onClick={() => void updateRecord(row.id)}>{savingId === row.id ? 'Saving…' : 'Save changes'}</Button>
        </div>
      })}
      {rows.length === 0 && <EmptyState title={'No ' + (type === 'business' ? 'businesses' : 'services') + ' to manage'} description="New records will appear here after they are added to the group directory." />}
    </div>
  </SectionCard>
}
`

text = text.slice(0, start) + replacement + text.slice(end)
fs.writeFileSync(path, text)
