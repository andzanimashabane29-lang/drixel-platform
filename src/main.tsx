import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import Ecosystem from './Ecosystem'
import './styles.css'
import './premium.css'
import './ecosystem.css'

const isEcosystemHome = window.location.pathname === '/'
if (isEcosystemHome) document.body.classList.add('ecosystem-page')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isEcosystemHome ? <Ecosystem /> : <App />}
  </React.StrictMode>,
)
