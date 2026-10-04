import { createServer } from 'node:http'

const sendJson = (response, statusCode, body) => {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  response.end(JSON.stringify(body))
}

export function createApiServer(query) {
  return createServer(async (request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname

    if (request.method !== 'GET') {
      response.setHeader('Allow', 'GET')
      return sendJson(response, 405, { error: 'Method not allowed' })
    }

    if (pathname === '/api/health') {
      try {
        await query('SELECT 1')
        return sendJson(response, 200, { status: 'ok', database: 'connected' })
      } catch {
        return sendJson(response, 503, { status: 'unavailable', database: 'unavailable' })
      }
    }

    if (pathname === '/api/portfolio') {
      try {
        const [businessResult, serviceResult] = await Promise.all([
          query(`
            SELECT id, slug, display_name AS name, kind, status
            FROM drixel.organizations
            WHERE kind IN ('business_unit', 'subsidiary')
            ORDER BY display_name
          `),
          query(`
            SELECT app.id, app.slug, app.display_name AS name, app.status,
                   owner.slug AS owner_slug, owner.display_name AS owner_name
            FROM drixel.applications AS app
            JOIN drixel.organizations AS owner ON owner.id = app.owner_organization_id
            WHERE owner.kind IN ('group', 'business_unit', 'subsidiary')
            ORDER BY owner.display_name, app.display_name
          `),
        ])
        return sendJson(response, 200, {
          businesses: businessResult.rows,
          services: serviceResult.rows,
        })
      } catch {
        return sendJson(response, 503, { error: 'Portfolio directory is unavailable' })
      }
    }

    return sendJson(response, 404, { error: 'Not found' })
  })
}
