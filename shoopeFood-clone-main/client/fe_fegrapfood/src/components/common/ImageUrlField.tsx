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
            <img src={previewUrl} alt="Xem truoc hinh anh" onError={(event) => {
              event.currentTarget.style.display = 'none'
            }} />
            <p className="field-hint">Xem truoc anh tu link da nhap</p>
          </>
        ) : (
          <div className="image-url-preview-empty">
            <span>Chua co link anh</span>
            <small>Dan link hinh (jpg, png, webp...) de hien thi tren trang dat mon</small>
          </div>
        )}
      </div>
    </div>
  )
}
