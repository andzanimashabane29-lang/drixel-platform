import fs from 'node:fs'

const path = 'src/App.tsx'
let app = fs.readFileSync(path, 'utf8')

app = app.replaceAll(
  `<StatusPill status={oidcConfigured ? 'active' : 'muted'} label={oidcConfigured ? 'Connected' : 'Not configured'} />`,
  `<span className="inline-flex items-center gap-2 text-[12px] text-muted-foreground"><span className={\`h-1.5 w-1.5 rounded-full \${oidcConfigured ? 'bg-success' : 'bg-tertiary-foreground'}\`} aria-hidden="true" />{oidcConfigured ? 'Connected' : 'Not configured'}</span>`,
)

app = app.replaceAll(
  `<StatusPill status={directoryConnected ? 'active' : 'muted'} label={directoryConnected ? 'Connected' : 'Unavailable'} />`,
  `<span className="inline-flex items-center gap-2 text-[12px] text-muted-foreground"><span className={\`h-1.5 w-1.5 rounded-full \${directoryConnected ? 'bg-success' : 'bg-tertiary-foreground'}\`} aria-hidden="true" />{directoryConnected ? 'Connected' : 'Unavailable'}</span>`,
)

app = app.replaceAll(
  `<StatusPill status="active" label="Connected" />`,
  `<span className="inline-flex items-center gap-2 text-[12px] text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />Connected</span>`,
)

fs.writeFileSync(path, app)
