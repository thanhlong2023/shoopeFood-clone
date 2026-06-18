import { useCallback, useEffect, useState } from 'react'
import {
  approveDriverApplication,
  getPendingDriverApplications,
  rejectDriverApplication,
  type DriverApplication,
} from '../../services/api/applications'

export default function AdminDriverApplicationsPanel() {
  const [applications, setApplications] = useState<DriverApplication[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actioningId, setActioningId] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      setErrorMessage(null)
      const data = await getPendingDriverApplications()
      setApplications(data)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể tải đơn tài xế')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  async function handleApprove(userId: number) {
    try {
      setActioningId(userId)
      setFeedback(null)
      await approveDriverApplication(userId)
      setFeedback(`Đã duyệt tài xế #${userId}`)
      await loadData()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể duyệt')
    } finally {
      setActioningId(null)
    }
  }

  async function handleReject(userId: number) {
    const reason = window.prompt('Lý do từ chối (tùy chọn):') || undefined
    if (reason === undefined) return

    try {
      setActioningId(userId)
      setFeedback(null)
      await rejectDriverApplication(userId, reason || undefined)
      setFeedback(`Đã từ chối tài xế #${userId}`)
      await loadData()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể từ chối')
    } finally {
      setActioningId(null)
    }
  }

  return (
    <div className="admin-workspace">
      <section className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <h2>Đơn đăng ký tài xế</h2>
            <p>Duyệt tài xế mới trước khi cấp quyền DRIVER.</p>
          </div>
          <button type="button" className="button-secondary" onClick={() => void loadData()} disabled={isLoading}>
            Tải lại
          </button>
        </div>

        {feedback ? <p className="restaurant-feedback success">{feedback}</p> : null}
        {errorMessage ? <p className="app-feedback error">{errorMessage}</p> : null}

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>SĐT</th>
                <th>Biển số</th>
                <th>CCCD</th>
                <th>Loại xe</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((item) => (
                <tr key={item.userId}>
                  <td>{item.fullName || `#${item.userId}`}</td>
                  <td>{item.phone}</td>
                  <td>{item.licensePlate}</td>
                  <td>{item.idCardNumber}</td>
                  <td>{item.vehicleType}</td>
                  <td>
                    <div className="admin-actions">
                      <button
                        type="button"
                        className="button-primary"
                        disabled={actioningId === item.userId}
                        onClick={() => void handleApprove(item.userId)}
                      >
                        Duyệt
                      </button>
                      <button
                        type="button"
                        className="button-danger"
                        disabled={actioningId === item.userId}
                        onClick={() => void handleReject(item.userId)}
                      >
                        Từ chối
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {isLoading ? <p className="empty-state">Đang tải...</p> : null}
          {!isLoading && applications.length === 0 ? (
            <p className="empty-state">Không có đơn tài xế chờ duyệt.</p>
          ) : null}
        </div>
      </section>
    </div>
  )
}
