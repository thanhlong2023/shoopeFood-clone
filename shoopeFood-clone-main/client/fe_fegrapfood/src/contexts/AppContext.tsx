import { createContext, useContext } from 'react'

type AppContextValue = {
  appName: string
}

const AppContext = createContext<AppContextValue | undefined>(undefined)

export const AppContextProvider = AppContext.Provider

export function useAppContext() {
  const context = useContext(AppContext)

  if (!context) {
    throw new Error('useAppContext must be used inside AppContextProvider')
  }

  return context
}
