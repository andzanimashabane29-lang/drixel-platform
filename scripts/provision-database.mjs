import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Pool } from 'pg'

const required = (name) => {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

const adminUrl = required('ADMIN_DATABASE_URL')
const managedStaging = process.env.MANAGED_STAGING === 'true'
const setupRoleLogins = !managedStaging && process.env.SETUP_DATABASE_ROLE_LOGINS === 'true'
const directoryPassword = setupRoleLogins ? required('POSTGRES_DIRECTORY_PASSWORD') : undefined
const managementPassword = setupRoleLogins ? required('POSTGRES_MANAGEMENT_PASSWORD') : undefined
const ssl = process.env.PGSSL === 'disable'
  ? undefined
  : { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED !== 'false' }

const pool = new Pool({ connectionString: adminUrl, ssl, max: 1, application_name: 'drixel-db-provisioner' })
const root = process.cwd()

const stagingSqlFiles = [
  'db/migrations/000_staging_portfolio.sql',
  'db/seed/001_portfolio_staging.sql',
]

const productionSqlFiles = [
  'db/migrations/001_initial.sql',
  'db/seed/001_portfolio.sql',
  'db/migrations/002_directory_reader.sql',
  'db/migrations/003_identity_management.sql',
  'db/migrations/004_portfolio_management.sql',
]

async function runFile(client, path) {
  const sql = await readFile(resolve(root, path), 'utf8')
  await client.query(sql)
  console.log(`Applied ${path}`)
}

async function setRolePassword(client, role, password) {
  const result = await client.query(`SELECT format('ALTER ROLE ${role} LOGIN PASSWORD %L', $1) AS statement`, [password])
  await client.query(result.rows[0].statement)
  console.log(`Configured login for ${role}`)
}

async function bootstrapOwner(client) {
  const email = process.env.OIDC_BOOTSTRAP_ADMIN_EMAIL
  const name = process.env.OIDC_BOOTSTRAP_ADMIN_NAME
  const issuer = process.env.OIDC_ISSUER
  const subject = process.env.OIDC_BOOTSTRAP_ADMIN_SUBJECT
  const provided = [email, name, issuer, subject].filter(Boolean).length

  if (provided === 0) return
  if (managedStaging) throw new Error('Owner bootstrap is disabled in MANAGED_STAGING mode')
  if (provided !== 4) throw new Error('Set OIDC_BOOTSTRAP_ADMIN_EMAIL, OIDC_BOOTSTRAP_ADMIN_NAME, OIDC_ISSUER and OIDC_BOOTSTRAP_ADMIN_SUBJECT together')

  await client.query("SELECT set_config('drixel.bootstrap_email', $1, false)", [email])
  await client.query("SELECT set_config('drixel.bootstrap_name', $1, false)", [name])
  await client.query("SELECT set_config('drixel.bootstrap_issuer', $1, false)", [issuer])
  await client.query("SELECT set_config('drixel.bootstrap_subject', $1, false)", [subject])
  await runFile(client, 'db/init/04_bootstrap_owner.sql')
}

const client = await pool.connect()
try {
  await client.query('BEGIN')
  const sqlFiles = managedStaging ? stagingSqlFiles : productionSqlFiles
  console.log(managedStaging
    ? 'Provisioning managed staging portfolio schema.'
    : 'Provisioning full production database schema.')
  for (const file of sqlFiles) await runFile(client, file)

  if (setupRoleLogins) {
    await setRolePassword(client, 'drixel_directory_reader', directoryPassword)
    await setRolePassword(client, 'drixel_management_api', managementPassword)
  } else {
    console.log('Skipping database role login mutation.')
  }

  await bootstrapOwner(client)
  await client.query('COMMIT')
  console.log('Drixel database provisioning completed successfully.')
} catch (error) {
  await client.query('ROLLBACK')
  console.error('Drixel database provisioning failed:', error?.message ?? error)
  process.exitCode = 1
} finally {
  client.release()
  await pool.end()
}
