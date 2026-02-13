'use client'

import { Search, Loader2, MapPin } from 'lucide-react'
import type { SearchResult } from '@/hooks/useLocationSearch'

interface MapSearchBarProps {
  searchQuery: string
  setSearchQuery: (q: string) => void
  isSearching: boolean
  searchResults: SearchResult[]
  showResults: boolean
  setShowResults: (v: boolean) => void
  isLoaded: boolean
  onSearch: (query?: string) => void
  onSelectResult: (result: SearchResult) => void
}

export function MapSearchBar({
  searchQuery,
  setSearchQuery,
  isSearching,
  searchResults,
  showResults,
  setShowResults,
  isLoaded,
  onSearch,
  onSelectResult,
}: MapSearchBarProps) {
  return (
    <div className="relative search-container" onClick={(e) => e.stopPropagation()}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              if (e.target.value.length >= 3) {
                onSearch(e.target.value)
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                onSearch()
              }
            }}
            onFocus={() => searchResults.length > 0 && setShowResults(true)}
            placeholder="Buscar cidade, estado ou região..."
            className="w-full h-11 rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onSearch()
          }}
          disabled={isSearching || !isLoaded}
          className="h-11 px-6 rounded-xl bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {isSearching ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <MapPin size={16} />
          )}
          Buscar
        </button>
      </div>

      {showResults && searchResults.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-slate-200 shadow-xl z-[1000] overflow-hidden">
          {searchResults.map((result, idx) => (
            <button
              type="button"
              key={idx}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onSelectResult(result)
              }}
              className="w-full px-4 py-3 text-left hover:bg-emerald-50 transition-colors border-b border-slate-100 last:border-b-0"
            >
              <div className="font-medium text-slate-700 text-sm">
                {result.display_name.split(',')[0]}
              </div>
              <div className="text-xs text-slate-400 truncate">
                {result.display_name.split(',').slice(1, 4).join(',')}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
