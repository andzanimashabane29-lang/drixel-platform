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

const isEcosystemHome = window.location.pathname === '/'
if (isEcosystemHome) document.body.classList.add('ecosystem-page')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isEcosystemHome ? <Ecosystem /> : <App />}
  </React.StrictMode>,
)
