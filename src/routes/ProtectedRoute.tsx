import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../store/auth'

/**
 * Gate for the `/app` tree. A signed-in caller (verified wallet/email OR a browse-only
 * guest) may enter; a session with no user at all is redirected to sign-in. Guests are
 * intentionally allowed in read-only. AppLayout surfaces a banner telling them their
 * writes won't persist until they verify, so a write never fails silently.
 */
export default function ProtectedRoute() {
  const user = useAuth((s) => s.user)
  return user ? <Outlet /> : <Navigate to="/login" replace />
}
