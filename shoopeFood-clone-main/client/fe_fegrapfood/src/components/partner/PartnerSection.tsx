import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import ApplyDriverModal from './ApplyDriverModal'
import ApplyMerchantModal from './ApplyMerchantModal'

export default function PartnerSection() {
  const navigate = useNavigate()
  const { isAuthenticated, hasRole } = useAuth()
  const showPartnerSection = !isAuthenticated || hasRole(['CUSTOMER'])
  const [driverOpen, setDriverOpen] = useState(false)
  const [merchantOpen, setMerchantOpen] = useState(false)

  function requireLogin(openModal: () => void) {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: '/' } })
      return
    }
    openModal()
  }

  if (!showPartnerSection) {
    return null
  }

  return (
    <>
      <section className="partner-section" aria-label="Hop tac cung GrabFood">
        <div className="partner-section-head">
          <span className="hero-badge">Hop tac</span>
          <h2>Ban muon gia nhap GrabFood?</h2>
          <p>Dang ky lam tai xe hoac mo nha hang. Don se duoc Admin xet duyet truoc khi kich hoat.</p>
        </div>

        <div className="partner-card-grid">
          <article className="partner-card partner-card--driver">
            <div className="partner-card-icon">🛵</div>
            <h3>Dang ky tai xe</h3>
            <p>Nhan don giao hang linh hoat. Can bien so xe va so CCCD.</p>
            <ul>
              <li>Thu nhap theo don</li>
              <li>Tu chon ca lam viec</li>
              <li>Duyet trong 24h</li>
            </ul>
            <button type="button" className="button-primary" onClick={() => requireLogin(() => setDriverOpen(true))}>
              Dang ky tai xe
            </button>
            <Link to="/driver/login" className="partner-card-link">
              Da duoc duyet? Dang nhap tai xe
            </Link>
          </article>

          <article className="partner-card partner-card--merchant">
            <div className="partner-card-icon">🏪</div>
            <h3>Mo nha hang</h3>
            <p>Dang ky quan an, tiep can khach hang moi tren ung dung.</p>
            <ul>
              <li>Qu?n l� th?c don online</li>
              <li>Nhan don tu khach</li>
              <li>Admin ho tro duyet quan</li>
            </ul>
            <button type="button" className="button-primary" onClick={() => requireLogin(() => setMerchantOpen(true))}>
              Dang ky mo quan
            </button>
            <Link to="/merchant/login" className="partner-card-link">
              Da duoc duyet? Dang nhap chu quan
            </Link>
          </article>
        </div>
      </section>

      <ApplyDriverModal isOpen={driverOpen} onClose={() => setDriverOpen(false)} />
      <ApplyMerchantModal isOpen={merchantOpen} onClose={() => setMerchantOpen(false)} />
    </>
  )
}
