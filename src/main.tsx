import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import Ecosystem from './Ecosystem'
import './styles.css'
import './ecosystem.css'
import './os-shell.css'
import './final-polish.css'

// Auth0 redirects away from the application and then back to /auth/callback.
// Some browser/privacy configurations can lose sessionStorage during that
// cross-site round trip. Mirror only the short-lived PKCE transaction into
// localStorage and transparently fall back to it on callback. No tokens are
// persisted here.
const oidcTransactionKey = 'drixel-oidc-transaction'
const storageSetItem = Storage.prototype.setItem
const storageGetItem = Storage.prototype.getItem
const storageRemoveItem = Storage.prototype.removeItem

Storage.prototype.setItem = function setItem(key: string, value: string) {
  storageSetItem.call(this, key, value)
  if (this === window.sessionStorage && key === oidcTransactionKey) {
    try { storageSetItem.call(window.localStorage, key, value) } catch { /* storage may be restricted */ }
  }
}

Storage.prototype.getItem = function getItem(key: string) {
  const value = storageGetItem.call(this, key)
  if (value !== null || this !== window.sessionStorage || key !== oidcTransactionKey) return value
  try { return storageGetItem.call(window.localStorage, key) } catch { return null }
}

Storage.prototype.removeItem = function removeItem(key: string) {
  storageRemoveItem.call(this, key)
  if (this === window.sessionStorage && key === oidcTransactionKey) {
    try { storageRemoveItem.call(window.localStorage, key) } catch { /* storage may be restricted */ }
  }
}

function callbackDiagnostic() {
  if (window.location.pathname !== '/auth/callback') return null
  const params = new URLSearchParams(window.location.search)
  const error = params.get('error')
  const description = params.get('error_description')
  if (error) return `Auth0 returned ${error}${description ? `: ${description}` : ''}`

  const code = params.get('code')
  const returnedState = params.get('state')
  const transactionText = sessionStorage.getItem(oidcTransactionKey)
  if (!code) return 'Auth0 returned to Drixel without an authorization code.'
  if (!returnedState) return 'Auth0 returned to Drixel without the OAuth state value.'
  if (!transactionText) return 'Drixel could not recover the saved PKCE login transaction after returning from Auth0.'

  try {
    const transaction = JSON.parse(transactionText) as { state?: string }
    if (!transaction.state) return 'The saved Drixel login transaction is invalid.'
    if (transaction.state !== returnedState) return 'The OAuth state returned by Auth0 does not match the login transaction created by Drixel.'
  } catch {
    return 'The saved Drixel login transaction could not be read.'
  }
  return null
}

function AuthCallbackFailure({ message }: { message: string }) {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#f5f5f7', color: '#111' }}>
      <section style={{ width: 'min(620px, 100%)', background: '#fff', border: '1px solid #ddd', borderRadius: 18, padding: 32 }}>
        <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#666' }}>Drixel ID</p>
        <h1 style={{ margin: '0 0 16px', fontSize: 28, letterSpacing: '-.03em' }}>Sign-in callback failed</h1>
        <p style={{ margin: '0 0 22px', lineHeight: 1.6, color: '#444' }}>{message}</p>
        <a href="/accounts" style={{ display: 'inline-block', padding: '11px 16px', borderRadius: 10, background: '#111', color: '#fff', textDecoration: 'none', fontWeight: 650 }}>Start a fresh sign-in</a>
      </section>
    </main>
  )
}

const callbackFailure = callbackDiagnostic()
const isEcosystemHome = window.location.pathname === '/'
if (isEcosystemHome) document.body.classList.add('ecosystem-page')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {callbackFailure
      ? <AuthCallbackFailure message={callbackFailure} />
      : isEcosystemHome ? <Ecosystem /> : <App />}
  </React.StrictMode>,
)
