import { Route, Routes } from 'react-router-dom'
import RequireAuth from '../components/common/RequireAuth'
import MainLayout from '../layouts/MainLayout'
import AdminPage from '../pages/AdminPage'
import HomePage from '../pages/HomePage'
import DriverPage from '../pages/DriverPage'
import LoginPage from '../pages/LoginPage'
import RestaurantDetailPage from '../pages/RestaurantDetailPage'
import RestaurantListPage from '../pages/RestaurantListPage'
import RestaurantFormPage from '../pages/RestaurantFormPage'
import TrackingPage from '../pages/TrackingPage'

export default function AppRouter() {
  return (
    <MainLayout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/tracking" element={<TrackingPage />} />
        <Route
          path="/driver"
          element={
            <RequireAuth allowedRoles={['DRIVER', 'ADMIN']}>
              <DriverPage />
            </RequireAuth>
          }
        />
        <Route
          path="/restaurants"
          element={
            <RequireAuth allowedRoles={['CUSTOMER', 'MERCHANT', 'ADMIN']}>
              <RestaurantListPage />
            </RequireAuth>
          }
        />
        <Route
          path="/restaurants/create"
          element={
            <RequireAuth allowedRoles={['MERCHANT', 'ADMIN']}>
              <RestaurantFormPage />
            </RequireAuth>
          }
        />
        <Route
          path="/restaurants/:id"
          element={
            <RequireAuth allowedRoles={['CUSTOMER', 'MERCHANT', 'ADMIN']}>
              <RestaurantDetailPage />
            </RequireAuth>
          }
        />
        <Route
          path="/restaurants/edit/:id"
          element={
            <RequireAuth allowedRoles={['MERCHANT', 'ADMIN']}>
              <RestaurantFormPage />
            </RequireAuth>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireAuth allowedRoles={['ADMIN']}>
              <AdminPage />
            </RequireAuth>
          }
        />
      </Routes>
    </MainLayout>
  )
}
