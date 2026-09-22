import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { StockProvider } from './store/StockContext'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode><BrowserRouter><StockProvider><App /></StockProvider></BrowserRouter></StrictMode>,
)
