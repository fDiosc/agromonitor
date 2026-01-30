'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { APP_VERSION } from '@/lib/version'
import { ChangelogModal } from './changelog-modal'

export function SidebarFooter() {
  const [showChangelog, setShowChangelog] = useState(false)

  return (
    <div className="p-3 border-t border-slate-700 bg-slate-800/30">
      <button
        onClick={() => setShowChangelog(true)}
        className="w-full flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors text-left"
      >
        <Sparkles size={16} className="text-emerald-400" />
        <span className="text-xs font-mono bg-slate-700 px-2 py-0.5 rounded">
          v{APP_VERSION}
        </span>
        <span className="text-xs">O que mudou?</span>
      </button>

      <p className="text-[10px] text-slate-500 text-center mt-2">
        Powered by Merx
      </p>

      <ChangelogModal
        open={showChangelog}
        onClose={() => setShowChangelog(false)}
      />
    </div>
  )
}
