import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App.jsx'
import BootMarker from './BootMarker.jsx'
import './index.css'

const rootElement = document.getElementById('root')

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <BootMarker />
    <App />
  </React.StrictMode>
)
