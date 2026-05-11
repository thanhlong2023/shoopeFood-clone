import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { AppRefineProvider } from './refine/RefineProvider'
import AppRouter from './routes/AppRouter'

function App() {
  return (
    <AuthProvider>
      <AppRefineProvider>
        <BrowserRouter>
          <AppRouter />
        </BrowserRouter>
      </AppRefineProvider>
    </AuthProvider>
  )
}

export default App
