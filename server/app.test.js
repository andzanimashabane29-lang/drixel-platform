import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createApiServer } from './app.js'

let server
let origin
let failQueries = false

before(async () => {
  server = createApiServer(async (sql) => {
    if (failQueries) throw new Error('database unavailable')
    if (sql.includes('SELECT 1')) return { rows: [{ '?column?': 1 }] }
    if (sql.includes('FROM drixel.applications')) {
      return { rows: [{ id: 'app-1', slug: 'excel-tutoring-academy', name: 'Excel Tutoring Academy Learning Platform', status: 'active', owner_slug: 'excel-tutoring-academy-sa', owner_name: 'Excel Tutoring Academy SA' }] }
    }
    return { rows: [{ id: 'org-1', slug: 'excel-tutoring-academy-sa', name: 'Excel Tutoring Academy SA', kind: 'business_unit', status: 'active' }] }
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  server.closeAllConnections()
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
})

test('health reports database connectivity', async () => {
  const response = await fetch(`${origin}/api/health`)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: 'ok', database: 'connected' })
})

test('portfolio returns business and service records from the directory query', async () => {
  const response = await fetch(`${origin}/api/portfolio`)
  const body = await response.json()
  assert.equal(response.status, 200)
  assert.equal(body.businesses[0].name, 'Excel Tutoring Academy SA')
  assert.equal(body.services[0].owner_slug, 'excel-tutoring-academy-sa')
})

test('portfolio reports unavailable without exposing database details', async () => {
  failQueries = true
  const response = await fetch(`${origin}/api/portfolio`)
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { error: 'Portfolio directory is unavailable' })
  failQueries = false
})

test('API rejects write methods', async () => {
  const response = await fetch(`${origin}/api/portfolio`, { method: 'POST' })
  assert.equal(response.status, 405)
  assert.equal(response.headers.get('allow'), 'GET')
})
