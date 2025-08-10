
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'
import { FORM_TEMPLATES } from '@/lib/form-templates'
import { validateFormData, convertToIncomeEntries } from '@/lib/data-processing'
import { readFile } from 'fs/promises'
import path from 'path'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'

interface Props {
  params: {
    id: string
  }
}

export async function POST(req: NextRequest, { params }: Props) {
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

    const { taxReturnId } = await req.json()

    if (!taxReturnId) {
      return NextResponse.json({ 
        error: 'Tax return ID is required' 
      }, { status: 400 })
    }

    // Get mapping with related data
    const mapping = await prisma.dataMapping.findFirst({
      where: {
        id: params.id,
        userId: user.id
      },
      include: {
        upload: true,
        template: true
      }
    })

    if (!mapping) {
      return NextResponse.json({ 
        error: 'Mapping not found' 
      }, { status: 404 })
    }

    // Load the original file data
    const uploadPath = path.join(process.cwd(), 'uploads', mapping.upload!.filePath)
    let fileData: any[] = []

    try {
      if (mapping.upload!.fileType === 'CSV') {
        const csvContent = await readFile(uploadPath, 'utf8')
        const parseResult = Papa.parse(csvContent, { header: true, skipEmptyLines: true })
        fileData = parseResult.data as any[]
      } else if (mapping.upload!.fileType === 'XLSX' || mapping.upload!.fileType === 'XLS') {
        const buffer = await readFile(uploadPath)
        const workbook = XLSX.read(buffer)
        const worksheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
        
        if (jsonData.length > 0) {
          const headers = jsonData[0] as string[]
          const dataRows = jsonData.slice(1)
          fileData = (dataRows as any[][]).map((row: any[]) => {
            const obj: any = {}
            headers.forEach((header: string, index: number) => {
              obj[header] = row[index] || null
            })
            return obj
          })
        }
      } else if (mapping.upload!.fileType === 'JSON') {
        const jsonContent = await readFile(uploadPath, 'utf8')
        const jsonData = JSON.parse(jsonContent)
        fileData = Array.isArray(jsonData) ? jsonData : [jsonData]
      }
    } catch (error) {
      return NextResponse.json({ 
        error: 'Failed to load upload file' 
      }, { status: 500 })
    }

    // Get form template
    const formTemplateFields = FORM_TEMPLATES[mapping.template.formType as keyof typeof FORM_TEMPLATES]
    
    if (!formTemplateFields) {
      return NextResponse.json({ 
        error: 'Form template not found' 
      }, { status: 404 })
    }

    // Validate and process data
    const validationResult = validateFormData(
      fileData, 
      formTemplateFields, 
      mapping.fieldMappings as Record<string, string>
    )

    if (!validationResult.success) {
      // Save processing errors
      await prisma.dataMapping.update({
        where: { id: mapping.id },
        data: {
          status: 'FAILED'
        }
      })

      return NextResponse.json({
        success: false,
        errors: validationResult.errors,
        processed: validationResult.processed
      })
    }

    // Convert to income entries
    const incomeEntries = convertToIncomeEntries(
      validationResult.data!,
      mapping.template.formType,
      taxReturnId
    )

    // Save processed form data records
    const processedForms = await Promise.all(
      validationResult.data!.map(async (formData, index) => {
        return await prisma.processedFormData.create({
          data: {
            taxReturnId,
            uploadId: mapping.uploadId,
            mappingId: mapping.id,
            formType: mapping.template.formType,
            formData,
            originalRow: fileData[index],
            rowNumber: index + 1,
            status: 'COMPLETED'
          }
        })
      })
    )

    // Create income entries in batches
    let createdEntries = 0
    const batchSize = 100

    for (let i = 0; i < incomeEntries.length; i += batchSize) {
      const batch = incomeEntries.slice(i, i + batchSize)
      await prisma.incomeEntry.createMany({
        data: batch
      })
      createdEntries += batch.length
    }

    // Update mapping status
    await prisma.dataMapping.update({
      where: { id: mapping.id },
      data: {
        status: 'COMPLETED'
      }
    })

    // Update upload processing stats
    await prisma.dataUpload.update({
      where: { id: mapping.uploadId! },
      data: {
        processedRows: createdEntries,
        status: 'COMPLETED'
      }
    })

    return NextResponse.json({
      success: true,
      processed: createdEntries,
      errors: [],
      processedForms: processedForms.length,
      incomeEntries: createdEntries
    })

  } catch (error) {
    console.error('Process mapping error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}
