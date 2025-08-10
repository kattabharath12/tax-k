
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'

export const dynamic = "force-dynamic"

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

function extractOcrTextFromPreviewData(previewData: any): string | null {
  if (!previewData) return null
  
  try {
    // If previewData is an array of extracted data objects
    if (Array.isArray(previewData) && previewData.length > 0) {
      const firstItem = previewData[0]
      if (firstItem && typeof firstItem === 'object' && firstItem.ocrText) {
        return firstItem.ocrText
      }
    }
    
    // If previewData has ocrText directly
    if (typeof previewData === 'object' && previewData.ocrText) {
      return previewData.ocrText
    }
    
    return null
  } catch (error) {
    console.warn('Error extracting OCR text from preview data:', error)
    return null
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const taxReturn = await prisma.taxReturn.findFirst({
      where: {
        id: params.id,
        userId: user.id
      }
    })

    if (!taxReturn) {
      return NextResponse.json({ error: 'Tax return not found' }, { status: 404 })
    }

    // Fetch both Document and DataUpload records for this tax return
    const [documents, dataUploads] = await Promise.all([
      prisma.document.findMany({
        where: { taxReturnId: params.id },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.dataUpload.findMany({
        where: { taxReturnId: params.id },
        orderBy: { createdAt: 'desc' }
      })
    ])

    // Convert DataUpload records to match Document interface
    const normalizedDataUploads = dataUploads.map(upload => {
      // Determine document type from filename
      const documentType = determineDocumentType(upload.fileName)
      
      // Extract OCR text from previewData if available
      const ocrText = extractOcrTextFromPreviewData(upload.previewData)
      
      return {
        id: upload.id,
        fileName: upload.fileName,
        fileType: upload.fileType,
        fileSize: upload.fileSize,
        documentType,
        processingStatus: upload.status === 'COMPLETED' ? 'COMPLETED' : 
                         upload.status === 'FAILED' ? 'FAILED' :
                         upload.status === 'PROCESSING' ? 'PROCESSING' : 'PENDING',
        isVerified: false,
        ocrText: ocrText,
        extractedData: upload.previewData || null,
        createdAt: upload.createdAt.toISOString(),
        updatedAt: upload.updatedAt.toISOString()
      }
    })

    // Combine and return both types
    const allDocuments = [
      ...documents.map(doc => ({
        ...doc,
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString()
      })),
      ...normalizedDataUploads
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return NextResponse.json(allDocuments)
  } catch (error) {
    console.error('Error fetching documents:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
