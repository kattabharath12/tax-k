
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'
import { FORM_TEMPLATES, FORM_DESCRIPTIONS } from '@/lib/form-templates'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const formType = searchParams.get('formType')

    if (formType) {
      // Get specific form template
      const template = await prisma.formTemplate.findFirst({
        where: {
          formType: formType as any,
          isDefault: true
        }
      })

      if (!template) {
        return NextResponse.json({ 
          error: 'Form template not found' 
        }, { status: 404 })
      }

      return NextResponse.json({ template })
    } else {
      // Get all available form types
      const templates = await prisma.formTemplate.findMany({
        where: {
          isDefault: true
        },
        orderBy: {
          formType: 'asc'
        }
      })

      const formTypes = Object.keys(FORM_TEMPLATES).map(type => ({
        formType: type,
        description: FORM_DESCRIPTIONS[type as keyof typeof FORM_DESCRIPTIONS] || type,
        available: templates.some(t => t.formType === type)
      }))

      return NextResponse.json({ 
        formTypes,
        templates 
      })
    }

  } catch (error) {
    console.error('Get form templates error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // This endpoint is for initializing default form templates
    const createdTemplates = []

    for (const [formType, fields] of Object.entries(FORM_TEMPLATES)) {
      // Check if template already exists
      const existing = await prisma.formTemplate.findFirst({
        where: {
          formType: formType as any,
          isDefault: true
        }
      })

      if (!existing) {
        const template = await prisma.formTemplate.create({
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
        createdTemplates.push(template)
      }
    }

    return NextResponse.json({ 
      success: true,
      created: createdTemplates.length,
      templates: createdTemplates
    })

  } catch (error) {
    console.error('Create form templates error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}
