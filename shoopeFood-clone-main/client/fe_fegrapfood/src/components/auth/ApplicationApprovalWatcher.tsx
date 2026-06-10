import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { getMyApplicationStatus } from '../../services/api/applications'
import { getDefaultRedirect } from '../../utils/loginPaths'
import type { UserRole } from '../../types'

const POLL_INTERVAL_MS = 4000

export default function ApplicationApprovalWatcher() {
  const navigate = useNavigate()
  const { isAuthenticated, user, activateRole } = useAuth()
  const isCheckingRef = useRef(false)
  const hasRedirectedRef = useRef(false)

  useEffect(() => {
    if (!isAuthenticated || !user) {
      hasRedirectedRef.current = false
      return undefined
    }

    if (user.role === 'ADMIN') {
      return undefined
    }

    async function checkApproval() {
      if (isCheckingRef.current || hasRedirectedRef.current) {
        return
      }

      isCheckingRef.current = true

      try {
        const status = await getMyApplicationStatus()
        const accountRole = (status.role || status.roles[0]) as UserRole | undefined
        const activeRole = user!.role

        if (!accountRole || accountRole === activeRole) {
          return
        }

        const driverReady = accountRole === 'DRIVER' && status.driver?.approvalStatus === 'APPROVED'
        const merchantReady = accountRole === 'MERCHANT' && Boolean(status.merchant.approvedRestaurant)

        if (!driverReady && !merchantReady) {
          return
        }

        hasRedirectedRef.current = true
        await activateRole(accountRole)
        navigate(getDefaultRedirect(accountRole), { replace: true })
      } catch {
        // Ignore polling errors; user can refresh manually.
      } finally {
        isCheckingRef.current = false
      }
    }

    void checkApproval()
    const timer = window.setInterval(() => void checkApproval(), POLL_INTERVAL_MS)

    return () => window.clearInterval(timer)
  }, [activateRole, isAuthenticated, navigate, user])

  return null
}
