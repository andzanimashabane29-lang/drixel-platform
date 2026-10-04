import assert from 'node:assert/strict'
import { generateKeyPairSync, sign } from 'node:crypto'
import { test } from 'node:test'
import { createOidcVerifier } from './oidc.js'

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', use: 'sig', alg: 'RS256' }

function makeToken(claims, key = privateKey) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test-key', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
  const input = `${header}.${payload}`
  return `${input}.${sign('RSA-SHA256', Buffer.from(input), key).toString('base64url')}`
}

const fetcher = async () => ({ ok: true, json: async () => ({ keys: [jwk] }) })
const now = () => 1_800_000_000_000
const validClaims = { iss: 'https://identity.example/realm/drixel', aud: 'drixel-platform-api', sub: 'account-subject', exp: now() / 1000 + 60, email: 'person@example.com' }

test('OIDC verifier accepts a correctly signed token for this issuer and API audience', async () => {
  const verify = createOidcVerifier({ issuer: validClaims.iss, audience: validClaims.aud, jwksUri: 'https://identity.example/jwks', fetcher, now })
  const claims = await verify(makeToken(validClaims))
  assert.equal(claims.sub, 'account-subject')
})

test('OIDC verifier rejects a wrong issuer, audience, expired token, and bad signature', async () => {
  const verify = createOidcVerifier({ issuer: validClaims.iss, audience: validClaims.aud, jwksUri: 'https://identity.example/jwks', fetcher, now })
  for (const claims of [
    { ...validClaims, iss: 'https://attacker.example' },
    { ...validClaims, aud: 'another-api' },
    { ...validClaims, exp: now() / 1000 - 1 },
  ]) await assert.rejects(verify(makeToken(claims)))
  const { privateKey: otherKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  await assert.rejects(verify(makeToken(validClaims, otherKey)))
})

test('OIDC verifier refuses tokens when provider settings are missing', async () => {
  const verify = createOidcVerifier({ issuer: '', audience: '', jwksUri: '' })
  await assert.rejects(verify('token'), /not configured/)
})
