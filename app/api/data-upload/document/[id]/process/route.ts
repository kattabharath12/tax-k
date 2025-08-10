

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'
import { readFile } from 'fs/promises'
import path from 'path'
import { authOptions } from '@/lib/auth'

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
            message: 'Starting document analysis...'
          })
          controller.enqueue(encoder.encode(`data: ${progressData}\n\n`))

          // Read the file
          const filePath = path.join(process.cwd(), 'uploads', 'documents', dataUpload.filePath)
          const fileBuffer = await readFile(filePath)
          
          // Update progress
          const readData = JSON.stringify({
            status: 'processing', 
            message: 'File loaded, extracting text...'
          })
          controller.enqueue(encoder.encode(`data: ${readData}\n\n`))

          // Process with LLM API
          const extractedData = await processDocumentWithLLM(fileBuffer, dataUpload.fileName)
          
          // Update progress
          const extractData = JSON.stringify({
            status: 'processing',
            message: 'Text extracted, structuring data...'
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
            message: 'Document processed successfully',
            preview: structuredData.slice(0, 5),
            totalRows: structuredData.length,
            extractedFields: Object.keys(structuredData[0] || {}),
            ocrText: extractedData.ocrText?.substring(0, 500) + '...'
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

async function processDocumentWithLLM(fileBuffer: Buffer, fileName: string): Promise<{ ocrText: string; extractedData: TaxDocumentData }> {
  const isPDF = fileName.toLowerCase().endsWith('.pdf')
  const isText = fileName.toLowerCase().endsWith('.txt')
  
  let messages
  if (isText) {
    // For text files, directly use the content
    const textContent = fileBuffer.toString('utf-8')
    messages = [{
      role: "user",
      content: `Please extract all tax information from this document text. Here is the content:

${textContent}

I need to identify:
1. Employee/Recipient name
2. Employer/Payer name and EIN/TIN
3. Wage amounts, tax withholdings
4. Interest, dividend, or other income amounts
5. Social Security and Medicare information

Please provide a comprehensive response with both the raw text and structured tax data.`
    }]
  } else if (isPDF) {
    // For PDF files, encode as base64 and use file type
    const base64String = fileBuffer.toString('base64')
    messages = [{
      role: "user",
      content: [
        {
          type: "file",
          file: {
            filename: fileName,
            file_data: `data:application/pdf;base64,${base64String}`
          }
        },
        {
          type: "text",
          text: `Please extract all text and tax information from this document. I need to identify:

1. All visible text content (for OCR text)
2. Specific tax form data including:
   - Employee/Recipient name
   - Employer/Payer name and EIN/TIN
   - Wage amounts, tax withholdings
   - Interest, dividend, or other income amounts
   - Social Security and Medicare information

Please provide a comprehensive response with both the raw text and structured tax data.`
        }
      ]
    }]
  } else {
    // For images, encode as base64 and use image_url type
    const base64String = fileBuffer.toString('base64')
    const mimeType = getMimeType(fileName)
    
    messages = [{
      role: "user", 
      content: [
        {
          type: "text",
          text: `Please extract all text and tax information from this document image. I need to identify:

1. All visible text content (for OCR text)  
2. Specific tax form data including:
   - Employee/Recipient name
   - Employer/Payer name and EIN/TIN
   - Wage amounts, tax withholdings
   - Interest, dividend, or other income amounts
   - Social Security and Medicare information

Please provide a comprehensive response with both the raw text and structured tax data.`
        },
        {
          type: "image_url",
          image_url: {
            url: `data:${mimeType};base64,${base64String}`
          }
        }
      ]
    }]
  }

  console.log('Making LLM API call...')
  if (!process.env.ABACUSAI_API_KEY) {
    throw new Error('ABACUSAI_API_KEY environment variable is not set')
  }

  const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      messages: messages,
      max_tokens: 4000,
      temperature: 0.1
    })
  })

  console.log('LLM API response status:', response.status)
  if (!response.ok) {
    const errorText = await response.text()
    console.error('LLM API error:', response.statusText, errorText)
    throw new Error(`LLM API error: ${response.statusText} - ${errorText}`)
  }

  const result = await response.json()
  const extractedText = result.choices?.[0]?.message?.content || ''
  
  // Parse the extracted text to separate OCR text from structured data
  const parsedData = parseExtractedText(extractedText)
  
  return parsedData
}

function getMimeType(fileName: string): string {
  const extension = fileName.toLowerCase().split('.').pop()
  switch (extension) {
    case 'png': return 'image/png'
    case 'jpg':
    case 'jpeg': return 'image/jpeg'  
    case 'tiff':
    case 'tif': return 'image/tiff'
    case 'bmp': return 'image/bmp'
    default: return 'image/jpeg'
  }
}

function parseExtractedText(extractedText: string): { ocrText: string; extractedData: TaxDocumentData } {
  // Simple extraction - the LLM should provide readable text
  // We'll extract key information using patterns
  
  const extractedData: TaxDocumentData = {}
  
  // Extract employee/recipient name
  const namePatterns = [
    /Employee(?:'s)?\s+name:?\s*([A-Z][a-z]+\s+[A-Z][a-z]+)/i,
    /Recipient(?:'s)?\s+name:?\s*([A-Z][a-z]+\s+[A-Z][a-z]+)/i,
    /Name:?\s*([A-Z][a-z]+\s+[A-Z][a-z]+)/i
  ]
  
  for (const pattern of namePatterns) {
    const match = extractedText.match(pattern)
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
    const match = extractedText.match(pattern)
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
      const match = extractedText.match(pattern)
      if (match?.[1]) {
        extractedData[field] = match[1].replace(/,/g, '')
        break
      }
    }
  }
  
  // Extract EIN/TIN
  const einPattern = /EIN|TIN[:\s]*([0-9-]{9,11})/i
  const einMatch = extractedText.match(einPattern)
  if (einMatch?.[1]) {
    extractedData.employerEIN = einMatch[1]
  }
  
  return {
    ocrText: extractedText,
    extractedData
  }
}

async function structureTaxData(data: { ocrText: string; extractedData: TaxDocumentData }): Promise<any[]> {
  // Convert the extracted data into rows that can be mapped to tax forms
  const structured = []
  
  if (Object.keys(data.extractedData).length > 0) {
    structured.push({
      // Create a structured row with all the extracted data
      ...data.extractedData,
      // Add source information
      sourceType: 'OCR_EXTRACTED',
      confidence: 'medium', // Could be enhanced with actual confidence scores
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
