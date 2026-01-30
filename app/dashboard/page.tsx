import { redirect } from 'next/navigation'

/**
 * Redirect /dashboard para /
 * O dashboard principal está na raiz do app
 */
export default function DashboardRedirect() {
  redirect('/')
}
