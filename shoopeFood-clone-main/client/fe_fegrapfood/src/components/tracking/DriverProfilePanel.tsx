import { useEffect, useState } from 'react'
import { getDriverProfile } from '../../services/api/drivers'
import type { DriverPublicProfile } from '../../types'


function vehicleLabel(vehicleType?: string) {
  if (!vehicleType) return 'Chưa cập nhật'
  const normalized = vehicleType.trim().toUpperCase()
  if (normalized === 'MOTORBIKE' || normalized === 'MOTO') return 'Xe máy'
  if (normalized === 'CAR') return 'Ô tô'
  if (normalized === 'BICYCLE') return 'Xe đạp'
  return vehicleType
}

type DriverProfilePanelProps = {
  driverId: number | null | undefined
}

export default function DriverProfilePanel({ driverId }: DriverProfilePanelProps) {
  const [profile, setProfile] = useState<DriverPublicProfile | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!driverId) {
      setProfile(null)
      setErrorMessage(null)
      return undefined
    }

    let ignore = false

    async function loadProfile() {
      try {
        setIsLoading(true)
        setErrorMessage(null)
        const id = driverId
        if (!id) {
          return
        }
        const data = await getDriverProfile(id)
        if (!ignore) {
          setProfile(data)
        }
      } catch (error) {
        if (!ignore) {
          setProfile(null)
          setErrorMessage(error instanceof Error ? error.message : 'Không thể tải thông tin tài xế')
        }
      } finally {
        if (!ignore) {
          setIsLoading(false)
        }
      }
    }

    void loadProfile()

    return () => {
      ignore = true
    }
  }, [driverId])

  if (!driverId) {
    return null
  }

  const driver = profile?.driver
  const initial = (driver?.fullName || 'T').trim().charAt(0).toUpperCase()

  return (
    <section className="driver-profile-panel" aria-label="Thông tin tài xế">
      <div className="driver-profile-panel__head">
        <h2>Thông tin tài xế</h2>
        {profile ? <span>{profile.completedCount} đơn đã giao</span> : null}
      </div>

      {isLoading ? <p className="driver-profile-panel__hint">Đang tải thông tin tài xế...</p> : null}
      {errorMessage ? <p className="app-feedback error">{errorMessage}</p> : null}

      {driver ? (
        <>
          <div className="driver-profile-card">
            <span className="driver-profile-card__avatar" aria-hidden="true">
              {initial}
            </span>
            <div className="driver-profile-card__body">
              <strong>{driver.fullName || 'Tài xế'}</strong>
              <span>SDT: {driver.phone || '-'}</span>
              <span>Đánh giá: {(driver.ratingAvg ?? 0).toFixed(1)} / 5</span>
              <span className={`driver-profile-status ${driver.isOnline ? 'online' : 'offline'}`}>
                {driver.isOnline ? 'Đang online' : 'Offline'}
              </span>
            </div>
          </div>

          <div className="driver-vehicle-card">
            <h3>Phương tiện</h3>
            <div className="driver-vehicle-grid">
              <div>
                <span>Loại xe</span>
                <strong>{vehicleLabel(driver.vehicleType)}</strong>
              </div>
              <div>
                <span>Biển số</span>
                <strong>{driver.licensePlate || '-'}</strong>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </section>
  )
}
