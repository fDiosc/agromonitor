'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { DisclaimerModal } from '@/components/modals/DisclaimerModal'

interface User {
  userId: string
  name: string
  email: string
  role: string
  workspaceId: string
  workspaceName: string
  hasAcceptedDisclaimer: boolean
}

interface AuthenticatedLayoutClientProps {
  children: React.ReactNode
  user: User
}

export function AuthenticatedLayoutClient({
  children,
  user,
}: AuthenticatedLayoutClientProps) {
  const router = useRouter()
  const [showDisclaimer, setShowDisclaimer] = useState(!user.hasAcceptedDisclaimer)

  const handleDisclaimerAccept = () => {
    setShowDisclaimer(false)
    router.refresh()
  }

  return (
    <>
      <DisclaimerModal
        isOpen={showDisclaimer}
        onAccept={handleDisclaimerAccept}
        userName={user.name}
        companyName={user.workspaceName}
      />
      <AppLayout user={user}>{children}</AppLayout>
    </>
  )
}
