import React from 'react'
import ReactDOM from 'react-dom/client'
import { loadTenantConfig, applyTheme } from './config/index.js'
import App from './App.jsx'
import './styles/global.css'

async function init() {
  await loadTenantConfig()
  applyTheme()

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}

init()
