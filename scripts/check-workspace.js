const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const workspaces = await prisma.workspace.findMany({
    select: { id: true, name: true }
  })
  console.log('Workspaces:', JSON.stringify(workspaces, null, 2))
  
  const producers = await prisma.producer.findMany({
    select: { id: true, name: true, workspaceId: true }
  })
  console.log('\nProdutores:', JSON.stringify(producers, null, 2))
  
  const fields = await prisma.field.count()
  console.log('\nTotal de talhões:', fields)
  
  await prisma.$disconnect()
}

main()
