const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  },
})

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname.startsWith('/api/')) {
      if (!env.API_ORIGIN) return json(503, { error: 'Production API origin is not configured' })

      let upstream
      try {
        upstream = new URL(env.API_ORIGIN)
      } catch {
        return json(503, { error: 'Production API origin is invalid' })
      }

      if (upstream.protocol !== 'https:') {
        return json(503, { error: 'Production API origin must use HTTPS' })
      }

      upstream.pathname = url.pathname
      upstream.search = url.search

      const headers = new Headers(request.headers)
      headers.delete('host')
      headers.set('x-forwarded-host', url.host)
      headers.set('x-forwarded-proto', 'https')

      try {
        const response = await fetch(new Request(upstream, {
          method: request.method,
          headers,
          body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
          redirect: 'manual',
        }))

        const responseHeaders = new Headers(response.headers)
        responseHeaders.set('x-content-type-options', 'nosniff')
        responseHeaders.set('referrer-policy', 'no-referrer')
        responseHeaders.delete('access-control-allow-origin')
        responseHeaders.delete('access-control-allow-credentials')

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
        })
      } catch {
        return json(502, { error: 'Production API is unreachable' })
      }
    }

    return env.ASSETS.fetch(request)
  },
}
