import { lazy, Suspense } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useStock } from './store/StockContext'
import { useWebMcp } from './hooks/useWebMcp'
import { useAuth } from './store/AuthContext'
import type { Role } from './types'

const AppLayout=lazy(()=>import('./components/AppLayout').then(module=>({default:module.AppLayout})))
const DashboardPage=lazy(()=>import('./pages/DashboardPage').then(module=>({default:module.DashboardPage})))
const InventoryPage=lazy(()=>import('./pages/InventoryPage').then(module=>({default:module.InventoryPage})))
const ItemDetailPage=lazy(()=>import('./pages/ItemDetailPage').then(module=>({default:module.ItemDetailPage})))
const StockFormPage=lazy(()=>import('./pages/StockFormPage').then(module=>({default:module.StockFormPage})))
const StockHistoryPage=lazy(()=>import('./pages/StockHistoryPage').then(module=>({default:module.StockHistoryPage})))
const LowStockPage=lazy(()=>import('./pages/LowStockPage').then(module=>({default:module.LowStockPage})))
const CategoriesPage=lazy(()=>import('./pages/MasterDataPages').then(module=>({default:module.CategoriesPage})))
const LocationsPage=lazy(()=>import('./pages/MasterDataPages').then(module=>({default:module.LocationsPage})))
const ReportsPage=lazy(()=>import('./pages/ReportsPage').then(module=>({default:module.ReportsPage})))
const UsersPage=lazy(()=>import('./pages/AdminPages').then(module=>({default:module.UsersPage})))
const SettingsPage=lazy(()=>import('./pages/AdminPages').then(module=>({default:module.SettingsPage})))
const LoginPage=lazy(()=>import('./pages/LoginPage').then(module=>({default:module.LoginPage})))
const RenewalsPage=lazy(()=>import('./pages/RenewalsPage').then(module=>({default:module.RenewalsPage})))
const AuditLogPage=lazy(()=>import('./pages/AuditLogPage').then(module=>({default:module.AuditLogPage})))
const DataToolsPage=lazy(()=>import('./pages/DataToolsPage').then(module=>({default:module.DataToolsPage})))
const StockControlPage=lazy(()=>import('./pages/StockControlPage').then(module=>({default:module.StockControlPage})))
const PurchaseRequestsPage=lazy(()=>import('./pages/PurchaseRequestsPage').then(module=>({default:module.PurchaseRequestsPage})))

function ProtectedRoute({roles}:{roles?:Role[]}){const {user,loading}=useAuth();if(loading)return <div className="route-loading">กำลังตรวจสอบสิทธิ์...</div>;if(!user)return <Navigate to="/login" replace/>;if(roles&&!roles.includes(user.role))return <Navigate to="/" replace/>;return <Outlet/>}

export default function App(){const {items}=useStock();useWebMcp(items);return <Suspense fallback={<div className="route-loading">กำลังโหลดหน้า...</div>}><Routes>
  <Route path="/login" element={<LoginPage/>}/>
  <Route element={<ProtectedRoute/>}><Route element={<AppLayout/>}>
    <Route index element={<DashboardPage/>}/><Route path="inventory" element={<InventoryPage/>}/><Route path="inventory/:id" element={<ItemDetailPage/>}/>
    <Route element={<ProtectedRoute roles={['admin','staff']}/>}><Route path="stock-in" element={<StockFormPage mode="IN"/>}/><Route path="stock-out" element={<StockFormPage mode="OUT"/>}/><Route path="stock-adjust" element={<StockControlPage mode="ADJUST"/>}/><Route path="stock-transfer" element={<StockControlPage mode="TRANSFER"/>}/><Route path="renewals" element={<RenewalsPage/>}/></Route><Route path="history" element={<StockHistoryPage/>}/>
    <Route path="low-stock" element={<LowStockPage/>}/>
    <Route path="reports" element={<ReportsPage/>}/><Route element={<ProtectedRoute roles={['admin','staff']}/>}><Route path="purchase-requests" element={<PurchaseRequestsPage/>}/><Route path="categories" element={<CategoriesPage/>}/></Route><Route element={<ProtectedRoute roles={['admin']}/>}><Route path="locations" element={<LocationsPage/>}/><Route path="users" element={<UsersPage/>}/><Route path="settings" element={<SettingsPage/>}/><Route path="audit-log" element={<AuditLogPage/>}/><Route path="data-tools" element={<DataToolsPage/>}/></Route>
  </Route></Route><Route path="*" element={<Navigate to="/" replace/>}/>
 </Routes></Suspense>}
