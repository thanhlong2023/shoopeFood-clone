type ImageUrlFieldProps = {
  id: string
  label: string
  value: string
  placeholder?: string
  hint?: string
  error?: string
  onChange: (value: string) => void
}

export default function ImageUrlField({
  id,
  label,
  value,
  placeholder = 'https://example.com/hinh-quan.jpg',
  hint,
  error,
  onChange,
}: ImageUrlFieldProps) {
  const previewUrl = value.trim()

  return (
    <div className="image-url-field">
      <label className="restaurant-field" htmlFor={id}>
        <span>{label}</span>
        <input
          id={id}
          name={id}
          type="url"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="off"
        />
        {hint ? <p className="field-hint">{hint}</p> : null}
        {error ? <p className="field-error">{error}</p> : null}
      </label>

      <div className="image-url-preview" aria-live="polite">
        {previewUrl ? (
          <>
            <img src={previewUrl} alt="Xem trước hình ảnh" onError={(event) => {
              event.currentTarget.style.display = 'none'
            }} />
            <p className="field-hint">Xem trước ảnh từ link đã nhập</p>
          </>
        ) : (
          <div className="image-url-preview-empty">
            <span>Chưa có link ảnh</span>
            <small>Dán link hình (jpg, png, webp...) để hiển thị trên trang đặt món</small>
          </div>
        )}
      </div>
    </div>
  )
}
