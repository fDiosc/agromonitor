'use client'

import Link from 'next/link'
import { Leaf, Plus, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function Header() {
  return (
    <header className="h-20 bg-white border-b flex items-center px-8 justify-between sticky top-0 z-50 shadow-sm">
      <Link href="/" className="flex items-center gap-3 cursor-pointer">
        <div className="bg-emerald-600 p-2.5 rounded-xl text-white shadow-md shadow-emerald-100">
          <Leaf size={24} />
        </div>
        <h1 className="text-xl font-black tracking-tighter text-slate-900">
          MERX <span className="text-emerald-600">AGRO</span>
        </h1>
      </Link>
      
      <div className="flex items-center gap-3">
        <Link href="/dashboard/logistics">
          <Button variant="outline" className="gap-2">
            <Truck size={18} />
            Diagnóstico Logístico
          </Button>
        </Link>
        
        <Link href="/fields/new">
          <Button>
            <Plus size={18} />
            Novo Talhão
          </Button>
        </Link>
      </div>
    </header>
  )
}
