import type { ReactNode } from 'react'
import ApplicationApprovalWatcher from '../components/auth/ApplicationApprovalWatcher'
import Footer from '../components/common/Footer'
import Navbar from '../components/common/Navbar'

type MainLayoutProps = {
  children: ReactNode
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="app-shell">
      <ApplicationApprovalWatcher />
      <Navbar />
      <main className="app-main">{children}</main>
      <Footer />
    </div>
  )
}
