import { API_BASE_URL } from './api/http'

type SocketHandler<T> = (payload: T) => void

type BrowserSocket = {
  on: <T>(eventName: string, handler: SocketHandler<T>) => void
  off: <T>(eventName: string, handler: SocketHandler<T>) => void
  emit: <T>(eventName: string, payload?: T) => void
  disconnect: () => void
}

type SocketFactory = (url: string) => BrowserSocket

type SocketWindow = Window & {
  io?: SocketFactory
}

let socketScriptPromise: Promise<void> | null = null

function loadSocketScript() {
  if ((window as SocketWindow).io) {
    return Promise.resolve()
  }

  if (socketScriptPromise) {
    return socketScriptPromise
  }

  socketScriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `${API_BASE_URL}/socket.io/socket.io.js`
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Không thể tải Socket.io client'))
    document.head.appendChild(script)
  })

  return socketScriptPromise
}

export async function createSocket() {
  await loadSocketScript()
  const socketFactory = (window as SocketWindow).io

  if (!socketFactory) {
    throw new Error('Socket.io client chua san sang')
  }

  return socketFactory(API_BASE_URL)
}
