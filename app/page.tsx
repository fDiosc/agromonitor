'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Header } from '@/components/layout/header'
import { FieldTable } from '@/components/fields/field-table'
import { Loader2 } from 'lucide-react'

interface Field {
  id: string
  name: string
  status: string
  city: string | null
  state: string | null
  areaHa: number | null
  agroData?: {
    areaHa: number | null
    volumeEstimatedKg: number | null
    confidence: string | null
    eosDate: string | null
  } | null
  analyses?: {
    templateId: string
    status: string
    statusColor: string | null
  }[]
}

export default function DashboardPage() {
  const [fields, setFields] = useState<Field[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [reprocessing, setReprocessing] = useState<string | null>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchFields = useCallback(async () => {
    try {
      const res = await fetch('/api/fields')
      const data = await res.json()
      setFields(data.fields || [])
      
      // Verificar se há campos processando
      const hasProcessing = data.fields?.some((f: Field) => f.status === 'PROCESSING')
      
      // Se há processando e não há polling, iniciar
      if (hasProcessing && !pollIntervalRef.current) {
        pollIntervalRef.current = setInterval(() => {
          fetchFields()
        }, 5000)
      }
      
      // Se não há processando e há polling, parar
      if (!hasProcessing && pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    } catch (error) {
      console.error('Error fetching fields:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFields()
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [fetchFields])

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este talhão?')) return

    setDeleting(id)
    try {
      await fetch(`/api/fields/${id}`, { method: 'DELETE' })
      setFields(prev => prev.filter(f => f.id !== id))
    } catch (error) {
      console.error('Error deleting field:', error)
      alert('Erro ao excluir talhão')
    } finally {
      setDeleting(null)
    }
  }

  const handleReprocess = async (id: string) => {
    if (!confirm('Reprocessar irá buscar novos dados e recalcular análises. Continuar?')) return

    setReprocessing(id)
    
    // Atualizar status para PROCESSING
    setFields(prev => prev.map(f => 
      f.id === id ? { ...f, status: 'PROCESSING' } : f
    ))

    try {
      const res = await fetch(`/api/fields/${id}/process`, { method: 'POST' })
      
      if (res.ok) {
        // Atualizar lista
        await fetchFields()
      } else {
        const data = await res.json()
        alert(`Erro: ${data.error || 'Falha ao reprocessar'}`)
        await fetchFields()
      }
    } catch (error) {
      console.error('Error reprocessing field:', error)
      alert('Erro ao reprocessar talhão')
      await fetchFields()
    } finally {
      setReprocessing(null)
    }
  }

  return (
    <>
      <Header />
      <main className="max-w-7xl mx-auto p-8">
        <h2 className="text-3xl font-black mb-8 text-slate-900">
          Carteira de Monitoramento
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-slate-400" />
          </div>
        ) : (
          <FieldTable
            fields={fields}
            onDelete={handleDelete}
            onReprocess={handleReprocess}
            isDeleting={deleting}
            isReprocessing={reprocessing}
          />
        )}
      </main>
    </>
  )
}
