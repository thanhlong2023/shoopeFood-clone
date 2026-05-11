import type { ReactNode } from 'react'
import Footer from '../components/common/Footer'
import Navbar from '../components/common/Navbar'

type MainLayoutProps = {
  children: ReactNode
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="app-main">{children}</main>
      <Footer />
    </div>
  )
}
