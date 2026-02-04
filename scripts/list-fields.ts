import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function listFields() {
  const fields = await prisma.field.findMany({
    where: {
      OR: [
        { city: { contains: 'Nova', mode: 'insensitive' } },
        { city: { contains: 'Bandeirantes', mode: 'insensitive' } },
        { name: { contains: 'Nova', mode: 'insensitive' } },
        { state: 'MT' }
      ]
    },
    select: {
      id: true,
      name: true,
      city: true,
      state: true,
      cropType: true
    },
    take: 50
  })
  
  console.log('\nCampos disponíveis:')
  console.log('----------------------------------------')
  for (const f of fields) {
    console.log(`${f.id} | ${f.name} | ${f.city}, ${f.state} | ${f.cropType}`)
  }
  
  await prisma.$disconnect()
}

listFields()
