'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Map,
  Truck,
  FileText,
  Users,
  UserCheck,
  Settings,
  Leaf,
  LogOut,
  ChevronRight,
  Building2,
  Warehouse,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SidebarFooter } from './sidebar-footer'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  roles?: string[] // Se undefined, todos podem ver
}

const mainNavItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    label: 'Gerenciar Talhões',
    href: '/fields',
    icon: Map,
  },
  {
    label: 'Produtores',
    href: '/producers',
    icon: UserCheck,
  },
  {
    label: 'Diagnóstico Logístico',
    href: '/dashboard/logistics',
    icon: Truck,
  },
  {
    label: 'Caixas Logísticas',
    href: '/dashboard/logistics-units',
    icon: Warehouse,
  },
  {
    label: 'Relatórios',
    href: '/reports',
    icon: FileText,
  },
]

const adminNavItems: NavItem[] = [
  {
    label: 'Workspaces',
    href: '/admin/workspaces',
    icon: Building2,
    roles: ['SUPER_ADMIN'], // Apenas Super Admin
  },
  {
    label: 'Usuários',
    href: '/admin/users',
    icon: Users,
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    label: 'Configurações',
    href: '/settings',
    icon: Settings,
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
]

interface SidebarProps {
  user: {
    name: string
    email: string
    role: string
    workspaceName: string
  }
  onLogout: () => void
}

export function Sidebar({ user, onLogout }: SidebarProps) {
  const pathname = usePathname()
  
  const canAccess = (item: NavItem) => {
    if (!item.roles) return true
    return item.roles.includes(user.role)
  }
  
  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    // Verifica correspondência exata ou se o próximo caractere é /
    // Isso evita que /dashboard/logistics-units corresponda a /dashboard/logistics
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col h-screen fixed left-0 top-0">
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-slate-700">
        <Link href="/" className="flex items-center gap-3">
          <div className="bg-emerald-600 p-2 rounded-lg">
            <Leaf size={20} />
          </div>
          <span className="text-lg font-bold tracking-tight">
            MERX <span className="text-emerald-400">AGRO</span>
          </span>
        </Link>
      </div>
      
      {/* Workspace info */}
      <div className="px-4 py-3 border-b border-slate-700 bg-slate-800/50">
        <p className="text-xs text-slate-400">Workspace</p>
        <p className="text-sm font-medium truncate">{user.workspaceName}</p>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {/* Main nav */}
        <div className="px-3 mb-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider px-3 mb-2">
            Menu
          </p>
          <ul className="space-y-1">
            {mainNavItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                    isActive(item.href)
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  )}
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                  {isActive(item.href) && (
                    <ChevronRight size={16} className="ml-auto" />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        
        {/* Admin nav */}
        {adminNavItems.some(canAccess) && (
          <div className="px-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider px-3 mb-2">
              Administração
            </p>
            <ul className="space-y-1">
              {adminNavItems.filter(canAccess).map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                      isActive(item.href)
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    )}
                  >
                    <item.icon size={18} />
                    <span>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </nav>
      
      {/* User info */}
      <div className="border-t border-slate-700 p-3">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center text-sm font-medium">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <p className="text-xs text-slate-400 truncate">{user.email}</p>
          </div>
          <button
            onClick={onLogout}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title="Sair"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
      
      {/* Footer com versão */}
      <SidebarFooter />
    </aside>
  )
}
