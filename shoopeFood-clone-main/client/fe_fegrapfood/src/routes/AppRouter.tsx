import { Route, Routes } from 'react-router-dom'
import RequireAuth from '../components/common/RequireAuth'
import RoleHomeRedirect from '../components/common/RoleHomeRedirect'
import MainLayout from '../layouts/MainLayout'
import AdminPage from '../pages/AdminPage'
import HomePage from '../pages/HomePage'
import DriverPage from '../pages/DriverPage'
import LoginPage from '../pages/LoginPage'
import RegisterPage from '../pages/RegisterPage'
import MerchantMenuPage from '../pages/MerchantMenuPage'
import MerchantOrdersPage from '../pages/MerchantOrdersPage'
import AdminTabRedirect from '../components/common/AdminTabRedirect'
import RestaurantDetailPage from '../pages/RestaurantDetailPage'
import ProfilePage from '../pages/ProfilePage'
import TrackingPage from '../pages/TrackingPage'
import BrowseRestaurantsPage from '../pages/BrowseRestaurantsPage'
import PaymentPage from '../pages/PaymentPage'
import QrPaymentPage from '../pages/QrPaymentPage'
import PortalPage from '../pages/PortalPage'

export default function AppRouter() {
  return (
    <MainLayout>
      <Routes>
        <Route
          path="/"
          element={
            <RoleHomeRedirect>
              <PortalPage />
            </RoleHomeRedirect>
          }
        />
        <Route
          path="/food"
          element={
            <HomePage />
          }
        />
        <Route path="/login" element={<LoginPage role="CUSTOMER" />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/merchant/login" element={<LoginPage role="MERCHANT" />} />
        <Route path="/driver/login" element={<LoginPage role="DRIVER" />} />
        <Route path="/admin/login" element={<LoginPage role="ADMIN" />} />
        <Route
          path="/profile"
          element={
            <RequireAuth allowedRoles={['CUSTOMER', 'DRIVER', 'MERCHANT', 'ADMIN']}>
              <ProfilePage />
            </RequireAuth>
          }
        />
        <Route
          path="/tracking"
          element={
            <RequireAuth>
              <TrackingPage />
            </RequireAuth>
          }
        />
        <Route
          path="/payment"
          element={
            <RequireAuth allowedRoles={['CUSTOMER']}>
              <PaymentPage />
            </RequireAuth>
          }
        />
        <Route
          path="/payment/qr"
          element={
            <RequireAuth allowedRoles={['CUSTOMER']}>
              <QrPaymentPage />
            </RequireAuth>
          }
        />
        <Route
          path="/driver"
          element={
            <RequireAuth allowedRoles={['DRIVER', 'ADMIN']}>
              <DriverPage />
            </RequireAuth>
          }
        />
        <Route
          path="/merchant/orders"
          element={
            <RequireAuth allowedRoles={['MERCHANT']}>
              <MerchantOrdersPage />
            </RequireAuth>
          }
        />
        <Route
          path="/merchant/menu"
          element={
            <RequireAuth allowedRoles={['MERCHANT']}>
              <MerchantMenuPage />
            </RequireAuth>
          }
        />
        <Route path="/restaurants" element={<BrowseRestaurantsPage />} />
        <Route
          path="/restaurants/new"
          element={
            <RequireAuth allowedRoles={['ADMIN']}>
              <AdminTabRedirect tab="restaurants" action="create" />
            </RequireAuth>
          }
        />
        <Route
          path="/restaurants/:id"
          element={<RestaurantDetailPage />}
        />
        <Route
          path="/restaurants/:id/edit"
          element={
            <RequireAuth allowedRoles={['ADMIN']}>
              <AdminTabRedirect tab="restaurants" />
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
