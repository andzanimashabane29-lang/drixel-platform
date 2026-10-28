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

test('Staging identity service is isolated, persistent and not public on HTTP',()=>{
 const yml=readFileSync(new URL('../identity/compose.staging.yml',import.meta.url),'utf8')
 assert.match(yml,/command: \["start","--optimized"/)
 assert.doesNotMatch(yml,/start-dev/)
 assert.match(yml,/drixel_identity_pg_staging:\/var\/lib\/postgresql\/data/)
 assert.match(yml,/KC_HOSTNAME_STRICT: "true"/)
 assert.match(yml,/expose: \["8080"\]/)
 assert.doesNotMatch(yml,/ports:\s*\n\s*-.*8080/)
 assert.match(yml,/DRIXEL_ID_DB_PASSWORD:\?/)
})
test('DRIXEL identity theme provides contrast and visible focus affordances',()=>{
 const css=readFileSync(new URL('../identity/keycloak/themes/drixel/login/resources/css/drixel.css',import.meta.url),'utf8')
 const cfg=readFileSync(new URL('../identity/keycloak/themes/drixel/login/theme.properties',import.meta.url),'utf8')
 assert.match(css,/DRIXEL ID/)
 assert.match(css,/:focus-visible/)
 assert.match(cfg,/parent=keycloak/)
})

test('Staging realm is imported with DRIXEL branding and an isolated store client',()=>{
 const yml=readFileSync(new URL('../identity/compose.staging.yml',import.meta.url),'utf8')
 assert.match(yml,/--import-realm/)
 assert.match(yml,/keycloak\/drixel-realm.json:\/opt\/keycloak\/data\/import\/drixel-realm.json:ro/)
 assert.equal(realm.loginTheme,'drixel')
 const client=realm.clients.find(row=>row.clientId==='drixel-sa-store-staging')
 assert.ok(client)
 assert.equal(client.publicClient,true)
 assert.deepEqual(client.redirectUris,['https://staging.drixelsa.co.za/za/member/drixel-callback'])
 assert.deepEqual(client.webOrigins,['https://staging.drixelsa.co.za'])
 assert.equal(client.attributes['pkce.code.challenge.method'],'S256')
})
