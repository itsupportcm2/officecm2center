import { Navigate, Route, Routes } from 'react-router-dom'
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
import { useStock } from './store/StockContext'
import { useWebMcp } from './hooks/useWebMcp'

export default function App(){const {items}=useStock();useWebMcp(items);return <Routes>
  <Route path="/login" element={<LoginPage/>}/>
  <Route element={<AppLayout/>}>
    <Route index element={<DashboardPage/>}/><Route path="inventory" element={<InventoryPage/>}/><Route path="inventory/:id" element={<ItemDetailPage/>}/>
    <Route path="stock-in" element={<StockFormPage mode="IN"/>}/><Route path="stock-out" element={<StockFormPage mode="OUT"/>}/><Route path="history" element={<StockHistoryPage/>}/>
    <Route path="low-stock" element={<LowStockPage/>}/><Route path="categories" element={<CategoriesPage/>}/><Route path="locations" element={<LocationsPage/>}/>
    <Route path="reports" element={<ReportsPage/>}/><Route path="users" element={<UsersPage/>}/><Route path="settings" element={<SettingsPage/>}/>
  </Route><Route path="*" element={<Navigate to="/" replace/>}/>
 </Routes>}
