import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AppProviders } from './app/providers/AppProviders.tsx'
import { supabase } from './platform/supabase/client'
import { consumeHandoff } from './platform/auth/app-handoff'

// Opened from another HPTTS app (#handoff=...): sign in with the one-time code before rendering.
void consumeHandoff(supabase).finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppProviders><App /></AppProviders>
    </StrictMode>,
  )
})
