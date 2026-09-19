import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

async function mount() {
  let Root = App
  // Dev-only theme preview. Stripped from production builds.
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('preview')) {
    Root = (await import('./dev/Preview.jsx')).default
  }
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <Root />
    </StrictMode>,
  )
}

mount()
