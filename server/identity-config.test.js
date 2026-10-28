import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const realm=JSON.parse(readFileSync(new URL('../identity/keycloak/drixel-realm.json',import.meta.url),'utf8'))

test('Drixel ID realm has safe initial sign-in defaults',()=>{
 assert.equal(realm.realm,'drixel')
 assert.equal(realm.enabled,true)
 assert.equal(realm.bruteForceProtected,true)
 assert.equal(realm.duplicateEmailsAllowed,false)
 assert.equal(realm.registrationAllowed,false,'Enable public registration only after verification and abuse controls are ready')
})

test('All interactive public clients require authorization code + PKCE',()=>{
 const clients=realm.clients.filter(client=>client.publicClient)
 assert.ok(clients.length>0)
 for(const client of clients){
  assert.equal(client.standardFlowEnabled,true,client.clientId)
  assert.equal(client.implicitFlowEnabled,false,client.clientId)
  assert.equal(client.directAccessGrantsEnabled,false,client.clientId)
  assert.equal(client.attributes?.['pkce.code.challenge.method'],'S256',client.clientId)
  assert.ok(client.redirectUris?.every(uri=>new URL(uri).protocol==='https:'||new URL(uri).hostname==='localhost'))
 }
})

test('Existing account integrations remain declared for staged migration',()=>{
 for(const id of ['drixel-platform-console','drixel-sa-firebase','a-chatz-supabase'])
  assert.ok(realm.clients.some(client=>client.clientId===id),id+' must not disappear from realm during migration')
})
