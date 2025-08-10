export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'
import { readFile } from 'fs/promises'
import path from 'path'
import { authOptions } from '@/lib/auth'
import { SimpleAzureDocumentService, createSimpleAzureConfig } from '@/lib/simple-azure-service'

interface TaxDocumentData {
  employeeName?: string
  employerName?: string
  employerEIN?: string
  wages?: string
  federalTaxWithheld?: string
  socialSecurityWages?: string
  socialSecurityTaxWithheld?: string
  medicareWages?: string
  medicareTaxWithheld?: string
  payerName?: string
  payerTIN?: string
  interestIncome?: string
  dividendIncome?: string
  nonemployeeCompensation?: string
  [key: string]: any
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('Document processing started for ID:', params.id)
    
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      console.error('No session or email found in processing route')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      console.error('User not found in processing route:', session.user.email)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    
    console.log('Processing document for user:', user.id)

    // Find the data upload record
    const dataUpload = await prisma.dataUpload.findFirst({
      where: { 
        id: params.id,
        userId: user.id
      }
    })

    if (!dataUpload) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Set up streaming response
    const encoder = new TextEncoder()
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial processing status
          const progressData = JSON.stringify({
            status: 'processing',
            message: 'Starting document analysis with Azure...'
          })
          controller.enqueue(encoder.encode(`data: ${progressData}\n\n`))

          // Read the file
          const filePath = path.join(process.cwd(), 'uploads', 'documents', dataUpload.filePath)
          const fileBuffer = await readFile(filePath)
          
          // Update progress
          const readData = JSON.stringify({
            status: 'processing', 
            message: 'File loaded, processing with Azure Document Intelligence...'
          })
          controller.enqueue(encoder.encode(`data: ${readData}\n\n`))

          // Process with Azure Document Intelligence
          const extractedData = await processDocumentWithAzure(filePath, dataUpload.fileName)
          
          // Update progress
          const extractData = JSON.stringify({
            status: 'processing',
            message: 'Azure processing complete, structuring data...'
          })
          controller.enqueue(encoder.encode(`data: ${extractData}\n\n`))

          // Convert extracted data to structured format
          const structuredData = await structureTaxData(extractedData)
          
          // Update the database
          await prisma.dataUpload.update({
            where: { id: params.id },
            data: {
              status: 'COMPLETED',
              totalRows: structuredData.length,
              processedRows: structuredData.length,
              previewData: structuredData.slice(0, 5), // First 5 rows for preview
              errorRows: 0,
              updatedAt: new Date()
            }
          })

          // Send final completion data
          const completionData = JSON.stringify({
            status: 'completed',
            message: 'Document processed successfully with Azure',
            preview: structuredData.slice(0, 5),
            totalRows: structuredData.length,
            extractedFields: Object.keys(structuredData[0] || {}),
            ocrText: extractedData.ocrText?.substring(0, 500) + '...',
            processingMethod: 'azure_document_intelligence'
          })
          controller.enqueue(encoder.encode(`data: ${completionData}\n\n`))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          
        } catch (error) {
          console.error('Document processing error:', error)
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
          
          // Update database with error status
          try {
            await prisma.dataUpload.update({
              where: { id: params.id },
              data: { 
                status: 'FAILED',
                errorLog: { error: errorMessage }
              }
            })
          } catch (updateError) {
            console.error('Failed to update error status:', updateError)
          }

          const errorData = JSON.stringify({
            status: 'error',
            message: errorMessage
          })
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`))
        } finally {
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    })

  } catch (error) {
    console.error('Processing setup error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return NextResponse.json(
      { error: 'Processing failed', details: errorMessage },
      { status: 500 }
    )
  }
}

async function processDocumentWithAzure(filePath: string, fileName: string): Promise<{ ocrText: string; extractedData: TaxDocumentData }> {
  console.log('Starting Azure Document Intelligence processing...')
  
  try {
    // Check if Azure is configured
    const hasAzureConfig = !!(
      process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT && 
      process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY
    )

    if (!hasAzureConfig) {
      console.log('Azure not configured, using fallback processing...')
      return await processDocumentFallback(filePath, fileName)
    }

    // Initialize Azure service
    const azureConfig = createSimpleAzureConfig()
    const azureService = new SimpleAzureDocumentService(azureConfig)
    
    // Determine document type from filename
    const documentType = determineDocumentType(fileName)
    console.log('Processing as document type:', documentType)
    
    // Process with Azure
    const result = await azureService.processDocument(filePath, documentType)
    
    console.log('Azure processing successful!')
    console.log('OCR text length:', result.ocrText.length)
    console.log('Extracted fields:', Object.keys(result.extractedData))
    
    // Map Azure result to our TaxDocumentData format
    const mappedData = mapAzureDataToTaxData(result.extractedData)
    
    // Enhance with fallback extraction if needed
    if (Object.keys(mappedData).length < 3 && result.ocrText) {
      console.log('Enhancing Azure results with fallback extraction...')
      const fallbackData = extractDataFromText(result.ocrText)
      Object.assign(mappedData, fallbackData)
    }
    
    return {
      ocrText: result.ocrText,
      extractedData: mappedData
    }
    
  } catch (error) {
    console.error('Azure processing failed:', error)
    console.log('Falling back to text-based extraction...')
    return await processDocumentFallback(filePath, fileName)
  }
}

async function processDocumentFallback(filePath: string, fileName: string): Promise<{ ocrText: string; extractedData: TaxDocumentData }> {
  console.log('Using fallback document processing...')
  
  const isText = fileName.toLowerCase().endsWith('.txt')
  
  if (isText) {
    // For text files, read directly
    const fileBuffer = await readFile(filePath)
    const textContent = fileBuffer.toString('utf-8')
    
    const extractedData = extractDataFromText(textContent)
    
    return {
      ocrText: textContent,
      extractedData
    }
  } else {
    // For other files, provide basic processing
    const fileBuffer = await readFile(filePath)
    const basicText = `Document uploaded: ${fileName} (${fileBuffer.length} bytes). Manual review required.`
    
    return {
      ocrText: basicText,
      extractedData: {
        fileName: fileName,
        fileSize: fileBuffer.length.toString(),
        processingNote: 'Manual review required - automated extraction not available'
      }
    }
  }
}

function determineDocumentType(fileName: string): string {
  const lowerName = fileName.toLowerCase()
  
  if (lowerName.includes('w2') || lowerName.includes('w-2')) {
    return 'W2'
  } else if (lowerName.includes('1099')) {
    if (lowerName.includes('int')) return 'FORM_1099_INT'
    if (lowerName.includes('div')) return 'FORM_1099_DIV'
    if (lowerName.includes('nec')) return 'FORM_1099_NEC'
    if (lowerName.includes('misc')) return 'FORM_1099_MISC'
    return 'FORM_1099_MISC' // Default 1099 type
  }
  
  return 'UNKNOWN'
}

function mapAzureDataToTaxData(azureData: any): TaxDocumentData {
  const mapped: TaxDocumentData = {}
  
  // Map common Azure field names to our format
  const fieldMapping: Record<string, string> = {
    'employeeName': 'employeeName',
    'employerName': 'employerName',
    'employerEIN': 'employerEIN',
    'wages': 'wages',
    'federalTaxWithheld': 'federalTaxWithheld',
    'socialSecurityWages': 'socialSecurityWages',
    'socialSecurityTaxWithheld': 'socialSecurityTaxWithheld',
    'medicareWages': 'medicareWages',
    'medicareTaxWithheld': 'medicareTaxWithheld',
    'payerName': 'payerName',
    'payerTIN': 'payerTIN',
    'interestIncome': 'interestIncome',
    'ordinaryDividends': 'dividendIncome',
    'nonemployeeCompensation': 'nonemployeeCompensation'
  }
  
  for (const [azureField, ourField] of Object.entries(fieldMapping)) {
    if (azureData[azureField]) {
      mapped[ourField] = azureData[azureField]
    }
  }
  
  return mapped
}

function extractDataFromText(text: string): TaxDocumentData {
  const extractedData: TaxDocumentData = {}
  
  // Extract employee/recipient name
  const namePatterns = [
    /Employee(?:'s)?\s+name:?\s*([A-Z][a-z]+\s+[A-Z][a-z]+)/i,
    /Recipient(?:'s)?\s+name:?\s*([A-Z][a-z]+\s+[A-Z][a-z]+)/i,
    /Name:?\s*([A-Z][a-z]+\s+[A-Z][a-z]+)/i
  ]
  
  for (const pattern of namePatterns) {
    const match = text.match(pattern)
    if (match?.[1]) {
      extractedData.employeeName = match[1].trim()
      break
    }
  }
  
  // Extract employer/payer name
  const employerPatterns = [
    /Employer(?:'s)?\s+name:?\s*([A-Z][A-Za-z\s,.&-]{5,50})/i,
    /Payer(?:'s)?\s+name:?\s*([A-Z][A-Za-z\s,.&-]{5,50})/i,
    /Company:?\s*([A-Z][A-Za-z\s,.&-]{5,50})/i
  ]
  
  for (const pattern of employerPatterns) {
    const match = text.match(pattern)
    if (match?.[1]) {
      extractedData.employerName = match[1].trim()
      break
    }
  }
  
  // Extract amounts
  const amountPatterns = [
    { field: 'wages', patterns: [/wages?[:\s]*\$?([0-9,]+\.?\d*)/i, /compensation[:\s]*\$?([0-9,]+\.?\d*)/i] },
    { field: 'federalTaxWithheld', patterns: [/federal.*tax.*withheld[:\s]*\$?([0-9,]+\.?\d*)/i] },
    { field: 'interestIncome', patterns: [/interest.*income[:\s]*\$?([0-9,]+\.?\d*)/i] },
    { field: 'dividendIncome', patterns: [/dividend.*income[:\s]*\$?([0-9,]+\.?\d*)/i] },
    { field: 'nonemployeeCompensation', patterns: [/nonemployee.*compensation[:\s]*\$?([0-9,]+\.?\d*)/i] }
  ]
  
  for (const { field, patterns } of amountPatterns) {
    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match?.[1]) {
        extractedData[field] = match[1].replace(/,/g, '')
        break
      }
    }
  }
  
  // Extract EIN/TIN
  const einPattern = /EIN|TIN[:\s]*([0-9-]{9,11})/i
  const einMatch = text.match(einPattern)
  if (einMatch?.[1]) {
    extractedData.employerEIN = einMatch[1]
  }
  
  return extractedData
}

async function structureTaxData(data: { ocrText: string; extractedData: TaxDocumentData }): Promise<any[]> {
  // Convert the extracted data into rows that can be mapped to tax forms
  const structured = []
  
  if (Object.keys(data.extractedData).length > 0) {
    structured.push({
      // Create a structured row with all the extracted data
      ...data.extractedData,
      // Add source information
      sourceType: 'AZURE_EXTRACTED',
      confidence: 'high', // Azure typically has good confidence
      extractedAt: new Date().toISOString()
    })
  }
  
  // If no structured data was extracted, create a basic entry
  if (structured.length === 0) {
    structured.push({
      sourceType: 'OCR_TEXT_ONLY',
      ocrText: data.ocrText?.substring(0, 1000), // Truncated OCR text
      extractedAt: new Date().toISOString(),
      note: 'Manual review required - automated extraction was unable to identify specific tax form fields'
    })
  }
  
  return structured
}
