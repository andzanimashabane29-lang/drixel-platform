import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource-variable/inter'
import App from './App'
import Ecosystem from './Ecosystem'
import './styles.css'
import './ecosystem.css'
import './theme.css'

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
    <main className="grid min-h-screen place-items-center bg-background p-6 text-foreground">
      <section className="w-full max-w-[620px] rounded-[var(--radius-card)] border border-border bg-surface p-8">
        <p className="mb-2 text-[12px] font-medium text-muted-foreground">Drixel ID</p>
        <h1 className="mb-4 text-[28px] font-semibold tracking-[-.02em]">Sign-in callback failed</h1>
        <p className="mb-6 leading-6 text-muted-foreground">{message}</p>
        <a href="/accounts" className="inline-flex h-9 items-center rounded-[var(--radius-control)] bg-foreground px-4 text-[13px] font-medium text-background">Start a fresh sign-in</a>
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
