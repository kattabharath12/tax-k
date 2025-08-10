
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'
import { FORM_TEMPLATES } from '@/lib/form-templates'
import { validateFormData, convertToIncomeEntries } from '@/lib/data-processing'
import { readFile } from 'fs/promises'
import path from 'path'
import { parseUploadedFile } from '@/lib/data-processing'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await req.json()
    const {
      uploadId,
      formType,
      mappingName,
      fieldMappings,
      isTemplate,
      taxReturnId
    } = body

    // Validate required fields
    if (!uploadId || !formType || !fieldMappings) {
      return NextResponse.json({ 
        error: 'Missing required fields' 
      }, { status: 400 })
    }

    // Get form template
    const formTemplate = await prisma.formTemplate.findFirst({
      where: {
        formType,
        isDefault: true
      }
    })

    if (!formTemplate) {
      return NextResponse.json({ 
        error: 'Form template not found' 
      }, { status: 404 })
    }

    // Create or update mapping
    const dataMapping = await prisma.dataMapping.create({
      data: {
        userId: user.id,
        uploadId,
        templateId: formTemplate.id,
        mappingName: mappingName || `${formType} Mapping`,
        isTemplate: isTemplate || false,
        fieldMappings,
        status: 'ACTIVE'
      }
    })

    return NextResponse.json({
      success: true,
      mapping: dataMapping
    })

  } catch (error) {
    console.error('Create mapping error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { searchParams } = new URL(req.url)
    const uploadId = searchParams.get('uploadId')
    const isTemplate = searchParams.get('isTemplate') === 'true'

    const mappings = await prisma.dataMapping.findMany({
      where: {
        userId: user.id,
        ...(uploadId && { uploadId }),
        ...(isTemplate !== undefined && { isTemplate })
      },
      include: {
        upload: {
          select: {
            fileName: true,
            fileType: true,
            totalRows: true
          }
        },
        template: {
          select: {
            formType: true,
            templateName: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ mappings })

  } catch (error) {
    console.error('Get mappings error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}
