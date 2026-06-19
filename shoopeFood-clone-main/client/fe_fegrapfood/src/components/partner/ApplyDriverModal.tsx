import { useState, type FormEvent } from 'react'
import Modal from '../common/Modal'
import { applyDriver } from '../../services/api/applications'

type ApplyDriverModalProps = {
  isOpen: boolean
  onClose: () => void
}

type FormErrors = Partial<Record<'licensePlate' | 'idCardNumber' | 'vehicleType', string>>

export default function ApplyDriverModal({ isOpen, onClose }: ApplyDriverModalProps) {
  const [licensePlate, setLicensePlate] = useState('')
  const [idCardNumber, setIdCardNumber] = useState('')
  const [vehicleType, setVehicleType] = useState('Motorbike')
  const [errors, setErrors] = useState<FormErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function resetState() {
    setLicensePlate('')
    setIdCardNumber('')
    setVehicleType('Motorbike')
    setErrors({})
    setFormError(null)
    setSuccessMessage(null)
  }

  function handleClose() {
    resetState()
    onClose()
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextErrors: FormErrors = {}
    const plate = licensePlate.trim().toUpperCase()
    const cccd = idCardNumber.trim()

    if (!plate) nextErrors.licensePlate = 'Bien so xe la bat buoc'
    if (!cccd) nextErrors.idCardNumber = 'So CCCD la bat buoc'
    else if (!/^\d{9,12}$/.test(cccd)) nextErrors.idCardNumber = 'CCCD phai co 9-12 chu so'

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    setFormError(null)

    try {
      setIsSubmitting(true)
      await applyDriver({ licensePlate: plate, idCardNumber: cccd, vehicleType })
      setSuccessMessage('Đã gửi don dang ky tài xế. Vui long cho Admin duyệt.')
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Không thể gửi đơn')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      title="Đăng ký tro thanh tài xế"
      subtitle="Dien thông tin that. Admin se xét duyệt trong 1-2 ngay lam viec."
      isOpen={isOpen}
      onClose={handleClose}
      footer={
        successMessage ? (
          <button type="button" className="button-primary" onClick={handleClose}>
            Dong
          </button>
        ) : (
          <>
            <button type="button" className="button-secondary" onClick={handleClose}>
              Huy
            </button>
            <button type="submit" form="apply-driver-form" className="button-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Dang gui...' : 'Gui don dang ky'}
            </button>
          </>
        )
      }
    >
      {successMessage ? (
        <div className="modal-success-state">
          <div className="modal-success-icon">✓</div>
          <p>{successMessage}</p>
          <p className="modal-success-hint">Hãy giữ tab này mở. Khi Admin duyệt, hệ thống sẽ tự chuyển bạn sang trang tài xế.</p>
        </div>
      ) : (
        <form id="apply-driver-form" className="modal-form" noValidate onSubmit={handleSubmit}>
          {formError ? <p className="app-feedback error">{formError}</p> : null}

          <label className="restaurant-field">
            <span>Bien so xe</span>
            <input
              value={licensePlate}
              onChange={(event) => {
                setLicensePlate(event.target.value)
                setErrors((current) => ({ ...current, licensePlate: undefined }))
              }}
              placeholder="59A1-12345"
            />
            {errors.licensePlate ? <p className="field-error">{errors.licensePlate}</p> : null}
          </label>

          <label className="restaurant-field">
            <span>So CCCD / CMND</span>
            <input
              value={idCardNumber}
              onChange={(event) => {
                setIdCardNumber(event.target.value)
                setErrors((current) => ({ ...current, idCardNumber: undefined }))
              }}
              placeholder="079123456789"
            />
            {errors.idCardNumber ? <p className="field-error">{errors.idCardNumber}</p> : null}
          </label>

          <label className="restaurant-field">
            <span>Loai xe</span>
            <select value={vehicleType} onChange={(event) => setVehicleType(event.target.value)}>
              <option value="Motorbike">Xe may</option>
              <option value="Car">O to</option>
            </select>
          </label>
        </form>
      )}
    </Modal>
  )
}
