import { createPublicKey, verify as verifySignature } from 'node:crypto'

export class AuthenticationError extends Error {}

const decodePart = (value) => {
  try { return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) }
  catch { throw new AuthenticationError('Invalid bearer token') }
}

export function createOidcVerifier({ issuer, audience, jwksUri, fetcher = fetch, now = () => Date.now() }) {
  if (!issuer || !audience || !jwksUri) return async () => { throw new AuthenticationError('Identity provider is not configured') }
  const secureLocation = (value) => {
    try {
      const url = new URL(value)
      return url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    } catch { return false }
  }
  if (!secureLocation(issuer) || !secureLocation(jwksUri)) {
    return async () => { throw new AuthenticationError('Identity provider URLs must use HTTPS outside local development') }
  }
  let cachedKeys = new Map()
  let cacheUntil = 0

  const getKeys = async (forceRefresh = false) => {
    if (!forceRefresh && now() < cacheUntil && cachedKeys.size) return cachedKeys
    const response = await fetcher(jwksUri, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(5000) })
    if (!response.ok) throw new AuthenticationError('Identity provider keys are unavailable')
    const body = await response.json()
    if (!Array.isArray(body.keys)) throw new AuthenticationError('Invalid identity provider keys')
    cachedKeys = new Map(body.keys.filter((key) => key.kid && key.kty === 'RSA' && (!key.use || key.use === 'sig'))
      .map((key) => [key.kid, createPublicKey({ key, format: 'jwk' })]))
    cacheUntil = now() + 5 * 60 * 1000
    return cachedKeys
  }

  return async (token) => {
    if (typeof token !== 'string' || token.length > 16_384) throw new AuthenticationError('Invalid bearer token')
    const parts = token.split('.')
    if (parts.length !== 3) throw new AuthenticationError('Invalid bearer token')
    const header = decodePart(parts[0])
    if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new AuthenticationError('Unsupported bearer token')
    let keys = await getKeys()
    if (!keys.has(header.kid)) keys = await getKeys(true)
    const key = keys.get(header.kid)
    if (!key) throw new AuthenticationError('Invalid bearer token')
    const signed = Buffer.from(`${parts[0]}.${parts[1]}`)
    const signature = Buffer.from(parts[2], 'base64url')
    if (!verifySignature('RSA-SHA256', signed, key, signature)) throw new AuthenticationError('Invalid bearer token')

    const claims = decodePart(parts[1])
    const currentSeconds = Math.floor(now() / 1000)
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
    if (claims.iss !== issuer || !audiences.includes(audience) || !Number.isFinite(claims.exp) || claims.exp <= currentSeconds
      || (claims.nbf !== undefined && (!Number.isFinite(claims.nbf) || claims.nbf > currentSeconds))
      || typeof claims.sub !== 'string' || claims.sub.length === 0) {
      throw new AuthenticationError('Invalid bearer token')
    }
    return claims
  }
}

export function bearerToken(request) {
  const value = request.headers.authorization
  const match = typeof value === 'string' && value.match(/^Bearer ([A-Za-z0-9._~-]+)$/)
  return match?.[1]
}
