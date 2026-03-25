import { APP_NAME } from '../constants/app'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export default function HomePage() {
  useDocumentTitle(`${APP_NAME} | Home`)

  return (
    <section>
      <h1>{APP_NAME}</h1>
      <p>Project React da duoc tao cau truc san sang cho viec phat trien.</p>
    </section>
  )
}
