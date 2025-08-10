
import { PrismaClient } from '@prisma/client'
import { FORM_TEMPLATES } from '../lib/form-templates'

const prisma = new PrismaClient()

async function initializeFormTemplates() {
  console.log('Initializing form templates...')
  
  let created = 0
  let updated = 0
  
  for (const [formType, fields] of Object.entries(FORM_TEMPLATES)) {
    try {
      // Check if template already exists
      const existing = await prisma.formTemplate.findFirst({
        where: {
          formType: formType as any,
          isDefault: true
        }
      })

      if (existing) {
        // Update existing template
        await prisma.formTemplate.update({
          where: { id: existing.id },
          data: {
            formFields: fields as any,
            requiredFields: fields.filter(f => f.required).map(f => f.name),
            validationRules: {},
            updatedAt: new Date()
          }
        })
        updated++
        console.log(`Updated template for ${formType}`)
      } else {
        // Create new template
        await prisma.formTemplate.create({
          data: {
            formType: formType as any,
            templateName: 'Default Template',
            templateVersion: '1.0',
            isDefault: true,
            formFields: fields as any,
            requiredFields: fields.filter(f => f.required).map(f => f.name),
            validationRules: {}
          }
        })
        created++
        console.log(`Created template for ${formType}`)
      }
    } catch (error) {
      console.error(`Error processing ${formType}:`, error)
    }
  }

  console.log(`\nForm template initialization complete:`)
  console.log(`- Created: ${created} templates`)
  console.log(`- Updated: ${updated} templates`)
  console.log(`- Total: ${created + updated} templates processed`)
}

initializeFormTemplates()
  .catch((e) => {
    console.error('Error initializing form templates:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
