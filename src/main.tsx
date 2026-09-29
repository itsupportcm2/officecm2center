import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { StockProvider } from './store/StockContext'
import { RenewalProvider } from './store/RenewalContext'
import { AuthProvider } from './store/AuthContext'
import { AuditProvider } from './store/AuditContext'
import { PurchaseProvider } from './store/PurchaseContext'
import { IssueRequestProvider } from './store/IssueRequestContext'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode><BrowserRouter><AuthProvider><AuditProvider><StockProvider><IssueRequestProvider><RenewalProvider><PurchaseProvider><App /></PurchaseProvider></RenewalProvider></IssueRequestProvider></StockProvider></AuditProvider></AuthProvider></BrowserRouter></StrictMode>,
)
