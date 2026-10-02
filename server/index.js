import { Pool } from 'pg'
import { createApiServer } from './app.js'

const pool = new Pool({
  host: process.env.PGHOST ?? '127.0.0.1',
  port: Number(process.env.PGPORT ?? 5432),
  database: process.env.PGDATABASE ?? 'drixel_platform',
  user: process.env.PGUSER ?? 'drixel_directory_reader',
  password: process.env.PGPASSWORD,
  max: 5,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
})

pool.on('error', () => {
  console.error('An idle database connection ended unexpectedly.')
})

const port = Number(process.env.API_PORT ?? 3000)
const server = createApiServer((text) => pool.query(text))

server.listen(port, '0.0.0.0', () => {
  console.log(`Drixel portfolio API listening on port ${port}`)
})

const shutdown = () => {
  server.close(() => pool.end().finally(() => process.exit(0)))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
