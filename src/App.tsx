import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { DashboardPage } from './pages/DashboardPage'
import { InventoryPage } from './pages/InventoryPage'
import { ItemDetailPage } from './pages/ItemDetailPage'
import { StockFormPage } from './pages/StockFormPage'
import { StockHistoryPage } from './pages/StockHistoryPage'
import { LowStockPage } from './pages/LowStockPage'
import { CategoriesPage, LocationsPage } from './pages/MasterDataPages'
import { ReportsPage } from './pages/ReportsPage'
import { UsersPage, SettingsPage } from './pages/AdminPages'
import { LoginPage } from './pages/LoginPage'
import { RenewalsPage } from './pages/RenewalsPage'
import { AuditLogPage } from './pages/AuditLogPage'
import { DataToolsPage } from './pages/DataToolsPage'
import { StockControlPage } from './pages/StockControlPage'
import { PurchaseRequestsPage } from './pages/PurchaseRequestsPage'
import { useStock } from './store/StockContext'
import { useWebMcp } from './hooks/useWebMcp'
import { useAuth } from './store/AuthContext'
import type { Role } from './types'

function ProtectedRoute({roles}:{roles?:Role[]}){const {user,loading}=useAuth();if(loading)return <div className="route-loading">กำลังตรวจสอบสิทธิ์...</div>;if(!user)return <Navigate to="/login" replace/>;if(roles&&!roles.includes(user.role))return <Navigate to="/" replace/>;return <Outlet/>}

export default function App(){const {items}=useStock();useWebMcp(items);return <Routes>
  <Route path="/login" element={<LoginPage/>}/>
  <Route element={<ProtectedRoute/>}><Route element={<AppLayout/>}>
    <Route index element={<DashboardPage/>}/><Route path="inventory" element={<InventoryPage/>}/><Route path="inventory/:id" element={<ItemDetailPage/>}/>
    <Route element={<ProtectedRoute roles={['admin','staff']}/>}><Route path="stock-in" element={<StockFormPage mode="IN"/>}/><Route path="stock-out" element={<StockFormPage mode="OUT"/>}/><Route path="stock-adjust" element={<StockControlPage mode="ADJUST"/>}/><Route path="stock-transfer" element={<StockControlPage mode="TRANSFER"/>}/><Route path="renewals" element={<RenewalsPage/>}/></Route><Route path="history" element={<StockHistoryPage/>}/>
    <Route path="low-stock" element={<LowStockPage/>}/>
    <Route path="reports" element={<ReportsPage/>}/><Route element={<ProtectedRoute roles={['admin','staff']}/>}><Route path="purchase-requests" element={<PurchaseRequestsPage/>}/><Route path="categories" element={<CategoriesPage/>}/></Route><Route element={<ProtectedRoute roles={['admin']}/>}><Route path="locations" element={<LocationsPage/>}/><Route path="users" element={<UsersPage/>}/><Route path="settings" element={<SettingsPage/>}/><Route path="audit-log" element={<AuditLogPage/>}/><Route path="data-tools" element={<DataToolsPage/>}/></Route>
  </Route></Route><Route path="*" element={<Navigate to="/" replace/>}/>
 </Routes>}
