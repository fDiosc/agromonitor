import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function deleteField() {
  const fieldId = process.argv[2]
  
  if (!fieldId) {
    // Listar todos os fields para o usuário escolher
    const fields = await prisma.field.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    })
    
    console.log('\n=== Talhões no banco ===\n')
    
    if (fields.length === 0) {
      console.log('Nenhum talhão encontrado.')
    } else {
      fields.forEach(f => {
        console.log(`ID: ${f.id}`)
        console.log(`  Nome: ${f.name}`)
        console.log(`  Status: ${f.status}`)
        console.log(`  Criado: ${f.createdAt.toLocaleString('pt-BR')}`)
        console.log('')
      })
      console.log('Para deletar, execute: npx ts-node scripts/delete-field.ts <ID>')
    }
    
    await prisma.$disconnect()
    return
  }
  
  try {
    // Deletar em cascata
    console.log(`Deletando talhão ${fieldId}...`)
    
    // Deletar dados relacionados primeiro
    await prisma.ndviDataPoint.deleteMany({ where: { fieldId } })
    await prisma.analysis.deleteMany({ where: { fieldId } })
    await prisma.agroData.deleteMany({ where: { fieldId } })
    
    // Deletar o talhão
    const deleted = await prisma.field.delete({
      where: { id: fieldId }
    })
    
    console.log(`✓ Talhão "${deleted.name}" deletado com sucesso!`)
  } catch (error: any) {
    if (error.code === 'P2025') {
      console.error(`Erro: Talhão com ID "${fieldId}" não encontrado.`)
    } else {
      console.error('Erro ao deletar:', error)
    }
  }
  
  await prisma.$disconnect()
}

deleteField()
