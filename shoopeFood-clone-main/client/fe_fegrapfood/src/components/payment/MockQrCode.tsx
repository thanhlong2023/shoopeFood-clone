import { useMemo } from 'react'

type MockQrCodeProps = {
  seed: string
}

export default function MockQrCode({ seed }: MockQrCodeProps) {
  const cells = useMemo(() => {
    const size = 17
    const hashSeed = Array.from(seed).reduce((total, char) => total + char.charCodeAt(0), 0)

    return Array.from({ length: size * size }, (_, index) => {
      const row = Math.floor(index / size)
      const col = index % size
      const inTopLeft = row < 5 && col < 5
      const inTopRight = row < 5 && col > size - 6
      const inBottomLeft = row > size - 6 && col < 5
      const inFinder = inTopLeft || inTopRight || inBottomLeft

      if (inFinder) {
        const localRow = row < 5 ? row : row - (size - 5)
        const localCol = col < 5 ? col : col - (size - 5)
        return localRow === 0 || localRow === 4 || localCol === 0 || localCol === 4 || (localRow === 2 && localCol === 2)
      }

      return ((row * 7 + col * 11 + hashSeed) % 5 === 0) || ((row + col + hashSeed) % 7 === 0)
    })
  }, [seed])

  return (
    <div className="mock-qr-code" style={{ gridTemplateColumns: 'repeat(17, minmax(0, 1fr))' }} aria-label="Mã QR mock">
      {cells.map((isFilled, index) => (
        <span key={index} className={isFilled ? 'mock-qr-code__cell is-filled' : 'mock-qr-code__cell'} />
      ))}
    </div>
  )
}
