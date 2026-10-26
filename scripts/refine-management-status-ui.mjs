import fs from 'node:fs'

const path = 'src/App.tsx'
let app = fs.readFileSync(path, 'utf8')

app = app.replace(
  '<SectionHeader title={title} description={description} action={<StatusPill status="active" label="Group admin" />} />',
  '<SectionHeader title={title} description={description} action={<span className="text-[11px] font-medium text-tertiary-foreground">Group administrator</span>} />',
)

app = app.replace(
  '<div className="flex items-center gap-2"><StatusPill status={draftStatus === \'active\' ? \'active\' : draftStatus === \'suspended\' ? \'warning\' : \'muted\'} label={statusLabel(draftStatus)} /><label className="sr-only" htmlFor={type + \'-status-\' + row.id}>{label} status</label><select id={type + \'-status-\' + row.id} className="h-9 min-w-0 flex-1 rounded-[var(--radius-control)] border border-border bg-surface px-2 text-[12px] text-foreground" value={draftStatus} onChange={(event) => setStatusDrafts((current) => ({ ...current, [row.id]: event.target.value }))}><option value="active">Active</option><option value="suspended">Suspended</option><option value="closed">Closed</option></select></div>',
  '<div className="flex items-center"><label className="sr-only" htmlFor={type + \'-status-\' + row.id}>{label} status</label><select id={type + \'-status-\' + row.id} className="h-9 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 text-[12px] text-foreground" value={draftStatus} onChange={(event) => setStatusDrafts((current) => ({ ...current, [row.id]: event.target.value }))}><option value="active">Active</option><option value="suspended">Suspended</option><option value="closed">Closed</option></select></div>',
)

fs.writeFileSync(path, app)
