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
  assert.deepEqual(await response.json(), { status: 'ok', database: 'connected', management_database: 'connected' })
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

test('account administration requires a configured bearer identity', async () => {
  const response = await fetch(`${origin}/api/accounts`)
  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), { error: 'Authentication required' })
})

test('account administration requires a bearer token when identity is configured', async () => {
  const protectedServer = createApiServer(async () => ({ rows: [] }), {
    managementQuery: async () => ({ rows: [{ authorized: false, accounts: [] }] }),
    verifyToken: async (token) => token === 'valid' ? { iss: 'https://id.example', sub: 'user-1' } : Promise.reject(new Error('bad token')),
  })
  await new Promise((resolve) => protectedServer.listen(0, '127.0.0.1', resolve))
  const protectedOrigin = `http://127.0.0.1:${protectedServer.address().port}`
  try {
    const response = await fetch(`${protectedOrigin}/api/accounts`, { headers: { authorization: 'Bearer valid' } })
    assert.equal(response.status, 403)
  } finally {
    protectedServer.closeAllConnections()
    await new Promise((resolve, reject) => protectedServer.close((error) => error ? reject(error) : resolve()))
  }
})

test('invitation rejects a missing or invalid bearer token before reading account data', async () => {
  const response = await fetch(`${origin}/api/invitations`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'person@example.com' }),
  })
  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), { error: 'Authentication required' })
})

test('account listing returns only records authorized by the scoped database query', async () => {
  let requestValues
  const protectedServer = createApiServer(async () => ({ rows: [] }), {
    verifyToken: async () => ({ iss: 'https://id.example', sub: 'owner-1' }),
    managementQuery: async (sql, values) => {
      assert.match(sql, /organization_memberships AS actor_membership/)
      assert.match(sql, /scope_tree/)
      requestValues = values
      return { rows: [{ authorized: true, accounts: [{ display_name: 'Employee', organization_name: 'Drixel SA' }] }] }
    },
  })
  await new Promise((resolve) => protectedServer.listen(0, '127.0.0.1', resolve))
  const protectedOrigin = `http://127.0.0.1:${protectedServer.address().port}`
  try {
    const response = await fetch(`${protectedOrigin}/api/accounts`, { headers: { authorization: 'Bearer valid' } })
    assert.equal(response.status, 200)
    assert.deepEqual(requestValues, ['https://id.example', 'owner-1'])
    assert.equal((await response.json()).accounts[0].organization_name, 'Drixel SA')
  } finally {
    protectedServer.closeAllConnections()
    await new Promise((resolve, reject) => protectedServer.close((error) => error ? reject(error) : resolve()))
  }
})

test('business invitation stores only a hashed one-time token and writes audit history', async () => {
  const statements = []
  const execute = async (sql, values = []) => {
    statements.push({ sql, values })
    if (sql.includes('SELECT actor.id AS actor_id')) return { rows: [{ actor_id: 'admin-id', organization_id: '11111111-1111-1111-1111-111111111111', role_id: 'role-id', organization_name: 'Drixel SA' }] }
    if (sql.includes('SELECT account.id, membership.id')) return { rows: [] }
    if (sql.includes('INSERT INTO drixel.accounts')) return { rows: [{ id: 'new-account-id' }] }
    if (sql.includes('INSERT INTO drixel.invitations')) return { rows: [{ id: 'invitation-id' }] }
    return { rows: [], rowCount: 1 }
  }
  const protectedServer = createApiServer(async () => ({ rows: [] }), {
    verifyToken: async () => ({ iss: 'https://id.example', sub: 'admin-1' }),
    transaction: async (operation) => operation(execute),
  })
  await new Promise((resolve) => protectedServer.listen(0, '127.0.0.1', resolve))
  const protectedOrigin = `http://127.0.0.1:${protectedServer.address().port}`
  try {
    const response = await fetch(`${protectedOrigin}/api/invitations`, {
      method: 'POST',
      headers: { authorization: 'Bearer valid', 'content-type': 'application/json' },
      body: JSON.stringify({ email: ' Person@Example.com ', display_name: 'Person Example', organization_id: '11111111-1111-1111-1111-111111111111', role_code: 'employee', membership_kind: 'employee' }),
    })
    const body = await response.json()
    assert.equal(response.status, 201)
    assert.equal(body.invitation.email, 'person@example.com')
    assert.equal(body.invitation.expires_in_days, 7)
    const invitationWrite = statements.find(({ sql }) => sql.includes('INSERT INTO drixel.invitations'))
    assert.ok(invitationWrite)
    assert.equal(invitationWrite.values[0].length, 64)
    assert.notEqual(invitationWrite.values[0], body.token)
    assert.ok(statements.some(({ sql }) => sql.includes("'account.invited'")))
  } finally {
    protectedServer.closeAllConnections()
    await new Promise((resolve, reject) => protectedServer.close((error) => error ? reject(error) : resolve()))
  }
})

test('service invitation stays pending and records the service-specific role scope', async () => {
  const statements = []
  const execute = async (sql, values = []) => {
    statements.push({ sql, values })
    if (sql.includes('SELECT actor.id AS actor_id')) return { rows: [{ actor_id: 'admin-id', role_id: 'app-role', organization_name: 'Drixel SA', application_name: 'Drixel SA Store' }] }
    if (sql.includes('SELECT account.id')) return { rows: [] }
    if (sql.includes('INSERT INTO drixel.accounts')) return { rows: [{ id: 'new-account-id' }] }
    if (sql.includes('INSERT INTO drixel.invitations')) return { rows: [{ id: 'service-invitation-id' }] }
    return { rows: [], rowCount: 1 }
  }
  const protectedServer = createApiServer(async () => ({ rows: [] }), {
    verifyToken: async () => ({ iss: 'https://id.example', sub: 'admin-1' }),
    transaction: async (operation) => operation(execute),
  })
  await new Promise((resolve) => protectedServer.listen(0, '127.0.0.1', resolve))
  const protectedOrigin = `http://127.0.0.1:${protectedServer.address().port}`
  try {
    const response = await fetch(`${protectedOrigin}/api/invitations`, {
      method: 'POST',
      headers: { authorization: 'Bearer valid', 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'customer@example.com', display_name: 'Customer', organization_id: '11111111-1111-1111-1111-111111111111', application_id: '22222222-2222-2222-2222-222222222222', role_code: 'end_user', membership_kind: 'customer' }),
    })
    const body = await response.json()
    assert.equal(response.status, 201)
    assert.equal(body.invitation.service, 'Drixel SA Store')
    const permission = statements.find(({ sql }) => sql.includes('SELECT actor.id AS actor_id'))
    assert.equal(permission.values[5], 'application')
    assert.ok(statements.some(({ sql }) => sql.includes('INSERT INTO drixel.application_memberships')))
    assert.equal(statements.some(({ sql }) => sql.includes('INSERT INTO drixel.role_assignments')), false)
  } finally {
    protectedServer.closeAllConnections()
    await new Promise((resolve, reject) => protectedServer.close((error) => error ? reject(error) : resolve()))
  }
})

test('invitation acceptance requires a verified matching identity and activates access transactionally', async () => {
  const statements = []
  const execute = async (sql, values = []) => {
    statements.push({ sql, values })
    if (sql.includes('SELECT invitation.id')) return { rows: [{
      id: 'invitation-id', account_id: 'account-id', organization_id: 'organization-id', role_id: 'role-id',
      invited_by: 'admin-id', display_name: 'Person Example', existing_account_id: null, has_other_identity: false,
    }] }
    if (sql.includes('SELECT account_id FROM drixel.account_identities')) return { rows: [{ account_id: 'account-id' }] }
    return { rows: [], rowCount: 1 }
  }
  const protectedServer = createApiServer(async () => ({ rows: [] }), {
    verifyToken: async () => ({ iss: 'https://id.example', sub: 'person-1' }),
    verifyIdToken: async () => ({ iss: 'https://id.example', sub: 'person-1', email: 'person@example.com', email_verified: true }),
    transaction: async (operation) => operation(execute),
  })
  await new Promise((resolve) => protectedServer.listen(0, '127.0.0.1', resolve))
  const protectedOrigin = `http://127.0.0.1:${protectedServer.address().port}`
  try {
    const response = await fetch(`${protectedOrigin}/api/invitations/accept`, {
      method: 'POST',
      headers: { authorization: 'Bearer access', 'content-type': 'application/json' },
      body: JSON.stringify({ token: 'a'.repeat(43), id_token: 'verified-id-token' }),
    })
    assert.equal(response.status, 200)
    assert.equal((await response.json()).accepted, true)
    assert.ok(statements.some(({ sql }) => sql.includes("SET status = 'active'")))
    assert.ok(statements.some(({ sql }) => sql.includes('INSERT INTO drixel.role_assignments')))
    assert.ok(statements.some(({ sql }) => sql.includes("'account.invitation_accepted'")))
  } finally {
    protectedServer.closeAllConnections()
    await new Promise((resolve, reject) => protectedServer.close((error) => error ? reject(error) : resolve()))
  }
})
