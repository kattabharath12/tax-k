

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

// Import authOptions
import { authOptions } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    console.log('Document upload started...')
    
    const session = await getServerSession(authOptions)
    console.log('Session:', session ? 'Found' : 'Not found')
    
    if (!session?.user?.email) {
      console.error('No session or email found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Looking for user:', session.user.email)
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      console.error('User not found for email:', session.user.email)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    
    console.log('User found:', user.id)

    const formData = await req.formData()
    const file = formData.get('file') as File
    const taxReturnId = formData.get('taxReturnId') as string

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    // Validate file type for documents (PDF and images, allow text for testing)
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/tiff', 'image/bmp', 'text/plain']
    console.log('File type:', file.type)
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Invalid file type. Supported types: PDF, PNG, JPEG, TIFF, BMP, TXT' 
      }, { status: 400 })
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ 
        error: 'File size exceeds 10MB limit' 
      }, { status: 400 })
    }

    // Save file to uploads directory
    const uploadDir = path.join(process.cwd(), 'uploads', 'documents')
    await mkdir(uploadDir, { recursive: true })
    
    const fileName = `${Date.now()}-${file.name}`
    const filePath = path.join(uploadDir, fileName)
    
    const bytes = await file.arrayBuffer()
    await writeFile(filePath, Buffer.from(bytes))

    // Determine document type based on filename
    const documentType = determineDocumentType(file.name)

    // Save upload record to database (using DataUpload table for consistency)
    const dataUpload = await prisma.dataUpload.create({
      data: {
        userId: user.id,
        taxReturnId: taxReturnId || null,
        fileName: file.name,
        fileType: file.name.split('.').pop()?.toUpperCase() || 'UNKNOWN',
        fileSize: file.size,
        filePath: fileName, // Store relative path
        totalRows: 0, // Will be updated after OCR processing
        previewData: [], // Will be populated after OCR processing
        status: 'PROCESSING', // Start as processing since OCR needs to happen
        processedRows: 0,
        errorRows: 0
      }
    })

    return NextResponse.json({
      success: true,
      id: dataUpload.id,
      upload: dataUpload,
      needsProcessing: true
    })

  } catch (error) {
    console.error('Document upload error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage }, 
      { status: 500 }
    )
  }
}

function determineDocumentType(fileName: string): string {
  const lowerName = fileName.toLowerCase()
  
  if (lowerName.includes('w-2') || lowerName.includes('w2')) {
    return 'W2'
  }
  if (lowerName.includes('1099-int')) {
    return 'FORM_1099_INT'
  }
  if (lowerName.includes('1099-div')) {
    return 'FORM_1099_DIV'
  }
  if (lowerName.includes('1099-misc')) {
    return 'FORM_1099_MISC'
  }
  if (lowerName.includes('1099-nec')) {
    return 'FORM_1099_NEC'
  }
  if (lowerName.includes('1099-r')) {
    return 'FORM_1099_R'
  }
  if (lowerName.includes('1099-g')) {
    return 'FORM_1099_G'
  }
  if (lowerName.includes('1099')) {
    return 'OTHER_TAX_DOCUMENT'
  }
  
  return 'UNKNOWN'
}
