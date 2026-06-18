import { useEffect, useState } from 'react'
import { getDriverProfile } from '../../services/api/drivers'
import type { DriverPublicProfile } from '../../types'


function vehicleLabel(vehicleType?: string) {
  if (!vehicleType) return 'Chua cap nhat'
  const normalized = vehicleType.trim().toUpperCase()
  if (normalized === 'MOTORBIKE' || normalized === 'MOTO') return 'Xe may'
  if (normalized === 'CAR') return 'O to'
  if (normalized === 'BICYCLE') return 'Xe dap'
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
          setErrorMessage(error instanceof Error ? error.message : 'Khong the tai thong tin tai xe')
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
    <section className="driver-profile-panel" aria-label="Thong tin tai xe">
      <div className="driver-profile-panel__head">
        <h2>Thong tin tai xe</h2>
        {profile ? <span>{profile.completedCount} don da giao</span> : null}
      </div>

      {isLoading ? <p className="driver-profile-panel__hint">Dang tai thong tin tai xe...</p> : null}
      {errorMessage ? <p className="app-feedback error">{errorMessage}</p> : null}

      {driver ? (
        <>
          <div className="driver-profile-card">
            <span className="driver-profile-card__avatar" aria-hidden="true">
              {initial}
            </span>
            <div className="driver-profile-card__body">
              <strong>{driver.fullName || 'Tai xe'}</strong>
              <span>SDT: {driver.phone || '-'}</span>
              <span>Danh gia: {(driver.ratingAvg ?? 0).toFixed(1)} / 5</span>
              <span className={`driver-profile-status ${driver.isOnline ? 'online' : 'offline'}`}>
                {driver.isOnline ? 'Dang online' : 'Offline'}
              </span>
            </div>
          </div>

          <div className="driver-vehicle-card">
            <h3>Phuong tien</h3>
            <div className="driver-vehicle-grid">
              <div>
                <span>Loai xe</span>
                <strong>{vehicleLabel(driver.vehicleType)}</strong>
              </div>
              <div>
                <span>Bien so</span>
                <strong>{driver.licensePlate || '-'}</strong>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </section>
  )
}
