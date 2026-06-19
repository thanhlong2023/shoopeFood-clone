import { useState, type FormEvent } from 'react'
import Modal from '../common/Modal'
import ImageUrlField from '../common/ImageUrlField'
import { applyMerchant } from '../../services/api/applications'

type ApplyMerchantModalProps = {
  isOpen: boolean
  onClose: () => void
}

type FormErrors = Partial<Record<'name' | 'address' | 'latitude' | 'longitude', string>>

export default function ApplyMerchantModal({ isOpen, onClose }: ApplyMerchantModalProps) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [latitude, setLatitude] = useState('10.7769')
  const [longitude, setLongitude] = useState('106.7009')
  const [openingTime, setOpeningTime] = useState('07:00')
  const [closingTime, setClosingTime] = useState('22:00')
  const [imageUrl, setImageUrl] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function resetState() {
    setName('')
    setAddress('')
    setLatitude('10.7769')
    setLongitude('106.7009')
    setOpeningTime('07:00')
    setClosingTime('22:00')
    setImageUrl('')
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
    const trimmedName = name.trim()
    const trimmedAddress = address.trim()
    const lat = Number(latitude)
    const lng = Number(longitude)

    if (!trimmedName) nextErrors.name = 'Tên nhà hàng la bat buoc'
    if (!trimmedAddress) nextErrors.address = 'Dia chi la bat buoc'
    if (!Number.isFinite(lat)) nextErrors.latitude = 'Vi do khong hop le'
    if (!Number.isFinite(lng)) nextErrors.longitude = 'Kinh do khong hop le'

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    setFormError(null)

    try {
      setIsSubmitting(true)
      await applyMerchant({
        name: trimmedName,
        address: trimmedAddress,
        latitude: lat,
        longitude: lng,
        openingTime: `${openingTime}:00`,
        closingTime: `${closingTime}:00`,
        imageUrl: imageUrl.trim() || null,
      })
      setSuccessMessage('Đã gửi don mo nhà hàng. Admin se duyệt quán của bạn.')
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Không thể gửi đơn')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      title="Đăng ký mo nhà hàng"
      subtitle="Mở quán tren GrabFood. Don se duoc Admin kiem tra trước khi hien thi."
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
            <button type="submit" form="apply-merchant-form" className="button-primary" disabled={isSubmitting}>
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
          <p className="modal-success-hint">Hãy giữ tab này mở. Khi Admin duyệt, hệ thống sẽ tự chuyển bạn sang trang chủ quán.</p>
        </div>
      ) : (
        <form id="apply-merchant-form" className="modal-form" noValidate onSubmit={handleSubmit}>
          {formError ? <p className="app-feedback error">{formError}</p> : null}

          <label className="restaurant-field">
            <span>Tên nhà hàng</span>
            <input
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setErrors((current) => ({ ...current, name: undefined }))
              }}
              placeholder="Com Tam Sai Gon"
            />
            {errors.name ? <p className="field-error">{errors.name}</p> : null}
          </label>

          <label className="restaurant-field">
            <span>Dia chi</span>
            <input
              value={address}
              onChange={(event) => {
                setAddress(event.target.value)
                setErrors((current) => ({ ...current, address: undefined }))
              }}
              placeholder="123 Nguyen Hue, Quan 1"
            />
            {errors.address ? <p className="field-error">{errors.address}</p> : null}
          </label>

          <div className="checkout-grid">
            <label className="restaurant-field">
              <span>Vi do</span>
              <input value={latitude} onChange={(event) => setLatitude(event.target.value)} />
              {errors.latitude ? <p className="field-error">{errors.latitude}</p> : null}
            </label>
            <label className="restaurant-field">
              <span>Kinh do</span>
              <input value={longitude} onChange={(event) => setLongitude(event.target.value)} />
              {errors.longitude ? <p className="field-error">{errors.longitude}</p> : null}
            </label>
          </div>

          <div className="checkout-grid">
            <label className="restaurant-field">
              <span>Mo cua</span>
              <input type="time" value={openingTime} onChange={(event) => setOpeningTime(event.target.value)} />
            </label>
            <label className="restaurant-field">
              <span>Dong cua</span>
              <input type="time" value={closingTime} onChange={(event) => setClosingTime(event.target.value)} />
            </label>
          </div>

          <ImageUrlField
            id="merchantApplyImage"
            label="Ảnh bìa nhà hàng"
            value={imageUrl}
            placeholder="https://example.com/quan.jpg"
            onChange={setImageUrl}
          />
        </form>
      )}
    </Modal>
  )
}
