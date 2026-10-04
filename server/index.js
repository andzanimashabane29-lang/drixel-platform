import { Pool } from 'pg'
import { createApiServer } from './app.js'
import { createOidcVerifier } from './oidc.js'

const directoryPool = new Pool({
  host: process.env.PGHOST ?? '127.0.0.1',
  port: Number(process.env.PGPORT ?? 5432),
  database: process.env.PGDATABASE ?? 'drixel_platform',
  user: process.env.PGUSER ?? 'drixel_directory_reader',
  password: process.env.PGPASSWORD,
  max: 5,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
})

const managementPool = new Pool({
  host: process.env.PGHOST ?? '127.0.0.1',
  port: Number(process.env.PGPORT ?? 5432),
  database: process.env.PGDATABASE ?? 'drixel_platform',
  user: process.env.PGMANAGEMENTUSER ?? 'drixel_management_api',
  password: process.env.PGMANAGEMENTPASSWORD,
  max: 5,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
})

for (const pool of [directoryPool, managementPool]) pool.on('error', () => {
  console.error('An idle database connection ended unexpectedly.')
})

const port = Number(process.env.API_PORT ?? 3000)
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

server.listen(port, '0.0.0.0', () => {
  console.log(`Drixel portfolio API listening on port ${port}`)
})

const shutdown = () => {
  server.close(() => Promise.all([directoryPool.end(), managementPool.end()]).finally(() => process.exit(0)))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
