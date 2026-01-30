'use client'

import { X, Sparkles, Bug, Zap } from 'lucide-react'
import { CHANGELOG, type ChangelogEntry } from '@/lib/version'

interface ChangelogModalProps {
  open: boolean
  onClose: () => void
}

function getTypeIcon(type: ChangelogEntry['type']) {
  switch (type) {
    case 'feature':
      return <Sparkles size={16} className="text-emerald-500" />
    case 'fix':
      return <Bug size={16} className="text-red-500" />
    case 'improvement':
      return <Zap size={16} className="text-yellow-500" />
  }
}

function getTypeLabel(type: ChangelogEntry['type']) {
  switch (type) {
    case 'feature':
      return 'Novidade'
    case 'fix':
      return 'Correção'
    case 'improvement':
      return 'Melhoria'
  }
}

export function ChangelogModal({ open, onClose }: ChangelogModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
              NOVIDADES
            </span>
            <h2 className="text-xl font-bold text-slate-900 mt-2">
              O que mudou?
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-6">
            {CHANGELOG.map((entry, idx) => (
              <div
                key={entry.version}
                className={idx === 0 ? '' : 'opacity-75'}
              >
                {/* Version header */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-mono font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded">
                    v{entry.version}
                  </span>
                  <span className="text-xs text-slate-500">{entry.date}</span>
                  <div className="flex items-center gap-1 ml-auto">
                    {getTypeIcon(entry.type)}
                    <span className="text-xs text-slate-600">
                      {getTypeLabel(entry.type)}
                    </span>
                  </div>
                </div>

                {/* Title */}
                <h3 className="font-semibold text-slate-800 mb-2">
                  {entry.title}
                </h3>

                {/* Changes */}
                <ul className="space-y-1">
                  {entry.changes.map((change, changeIdx) => (
                    <li
                      key={changeIdx}
                      className="text-sm text-slate-600 flex items-start gap-2"
                    >
                      <span className="text-emerald-500 mt-1">•</span>
                      {change}
                    </li>
                  ))}
                </ul>

                {/* Divider */}
                {idx < CHANGELOG.length - 1 && (
                  <hr className="mt-4 border-slate-200" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-slate-50 rounded-b-xl">
          <button
            onClick={onClose}
            className="w-full bg-slate-900 text-white py-2 px-4 rounded-lg font-medium hover:bg-slate-800 transition-colors"
          >
            Entendi!
          </button>
        </div>
      </div>
    </div>
  )
}
