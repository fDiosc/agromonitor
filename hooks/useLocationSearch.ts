'use client'

import { useState, useEffect } from 'react'

export interface SearchResult {
  display_name: string
  lat: string
  lon: string
  type: string
}

export interface UseLocationSearchResult {
  searchQuery: string
  setSearchQuery: (q: string) => void
  isSearching: boolean
  searchResults: SearchResult[]
  showResults: boolean
  setShowResults: (v: boolean) => void
  handleSearch: (query?: string) => Promise<void>
}

export function useLocationSearch(): UseLocationSearchResult {
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [showResults, setShowResults] = useState(false)

  const handleSearch = async (query?: string) => {
    const searchTerm = query || searchQuery
    if (!searchTerm.trim()) return

    setIsSearching(true)
    setShowResults(false)

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
        `format=json&` +
        `q=${encodeURIComponent(searchTerm + ', Brasil')}&` +
        `countrycodes=br&` +
        `limit=5&` +
        `addressdetails=1`,
        {
          headers: {
            'User-Agent': 'MerxAgroMonitor/1.0',
            'Accept-Language': 'pt-BR'
          }
        }
      )
      const data = await response.json()

      if (data.length > 0) {
        setSearchResults(data)
        setShowResults(true)
      } else {
        setSearchResults([])
      }
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setIsSearching(false)
    }
  }

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.search-container')) {
        setShowResults(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  return {
    searchQuery,
    setSearchQuery,
    isSearching,
    searchResults,
    showResults,
    setShowResults,
    handleSearch,
  }
}
