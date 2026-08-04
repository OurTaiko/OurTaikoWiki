import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { WikiProvider } from './context/WikiContext'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <WikiProvider><App /></WikiProvider>
    </BrowserRouter>
  </StrictMode>,
)
