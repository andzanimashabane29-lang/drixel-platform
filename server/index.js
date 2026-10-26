import { Pool } from 'pg'
import { createApiServer } from './app.js'
import { createOidcVerifier } from './oidc.js'

const isProduction = process.env.NODE_ENV === 'production'
const sslMode = process.env.PGSSL ?? (isProduction ? 'require' : 'disable')
const ssl = sslMode === 'require'
  ? { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED !== 'false' }
  : undefined

const requiredProduction = [
  'OIDC_ISSUER',
  'OIDC_AUDIENCE',
  'OIDC_CLIENT_ID',
  'OIDC_JWKS_URI',
]

if (isProduction) {
  const missing = requiredProduction.filter((name) => !process.env[name])
  if (!process.env.DIRECTORY_DATABASE_URL && !process.env.PGPASSWORD) missing.push('DIRECTORY_DATABASE_URL or PGPASSWORD')
  if (!process.env.MANAGEMENT_DATABASE_URL && !process.env.PGMANAGEMENTPASSWORD) missing.push('MANAGEMENT_DATABASE_URL or PGMANAGEMENTPASSWORD')
  if (missing.length) {
    console.error(`Missing required production configuration: ${missing.join(', ')}`)
    process.exit(1)
  }
}

const sharedPoolOptions = {
  max: Number(process.env.PGPOOL_MAX ?? 8),
  connectionTimeoutMillis: Number(process.env.PGCONNECT_TIMEOUT_MS ?? 5000),
  idleTimeoutMillis: Number(process.env.PGIDLE_TIMEOUT_MS ?? 30000),
  allowExitOnIdle: false,
  ssl,
}

const directoryPool = new Pool(process.env.DIRECTORY_DATABASE_URL ? {
  ...sharedPoolOptions,
  connectionString: process.env.DIRECTORY_DATABASE_URL,
  application_name: 'drixel-directory-api',
} : {
  ...sharedPoolOptions,
  host: process.env.PGHOST ?? '127.0.0.1',
  port: Number(process.env.PGPORT ?? 5432),
  database: process.env.PGDATABASE ?? 'drixel_platform',
  user: process.env.PGUSER ?? 'drixel_directory_reader',
  password: process.env.PGPASSWORD,
  application_name: 'drixel-directory-api',
})

const managementPool = new Pool(process.env.MANAGEMENT_DATABASE_URL ? {
  ...sharedPoolOptions,
  connectionString: process.env.MANAGEMENT_DATABASE_URL,
  application_name: 'drixel-management-api',
} : {
  ...sharedPoolOptions,
  host: process.env.PGHOST ?? '127.0.0.1',
  port: Number(process.env.PGPORT ?? 5432),
  database: process.env.PGDATABASE ?? 'drixel_platform',
  user: process.env.PGMANAGEMENTUSER ?? 'drixel_management_api',
  password: process.env.PGMANAGEMENTPASSWORD,
  application_name: 'drixel-management-api',
})

for (const pool of [directoryPool, managementPool]) pool.on('error', (error) => {
  console.error('An idle database connection ended unexpectedly.', error?.message ?? error)
})

const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3000)
const server = createApiServer((text, values) => directoryPool.query(text, values), {
  managementQuery: (text, values) => managementPool.query(text, values),
  transaction: async (operation) => {
    const client = await managementPool.connect()
    try {
      await client.query('BEGIN')
      const result = await operation((text, values) => client.query(text, values))
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  },
  verifyToken: createOidcVerifier({
    issuer: process.env.OIDC_ISSUER,
    audience: process.env.OIDC_AUDIENCE,
    jwksUri: process.env.OIDC_JWKS_URI,
  }),
  verifyIdToken: createOidcVerifier({
    issuer: process.env.OIDC_ISSUER,
    audience: process.env.OIDC_CLIENT_ID,
    jwksUri: process.env.OIDC_JWKS_URI,
  }),
})

server.keepAliveTimeout = Number(process.env.KEEP_ALIVE_TIMEOUT_MS ?? 65000)
server.headersTimeout = Number(process.env.HEADERS_TIMEOUT_MS ?? 66000)
server.requestTimeout = Number(process.env.REQUEST_TIMEOUT_MS ?? 30000)

server.listen(port, '0.0.0.0', () => {
  console.log(`Drixel platform API listening on port ${port}`)
})

let shuttingDown = false
const shutdown = (signal) => {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`Received ${signal}; shutting down Drixel platform API.`)
  const forceExit = setTimeout(() => process.exit(1), 10000)
  forceExit.unref()
  server.close(() => {
    Promise.all([directoryPool.end(), managementPool.end()])
      .finally(() => process.exit(0))
  })
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
