import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { AzureDocumentService, createAzureDocumentConfig } from "@/lib/azure-document-service"

export const dynamic = "force-dynamic"

// Types for extracted data
interface ExtractedTaxData {
  documentType: string
  ocrText: string
  extractedData: any
  confidence: number
  processingMethod: 'azure_document_intelligence'
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  console.log("=== DOCUMENT PROCESSING START ===")
  console.log("Document ID:", params.id)
  
  try {
    // Step 1: Authentication
    console.log("1. Checking authentication...")
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      console.log("❌ No session found")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.log("✅ Session found for:", session.user.email)

    // Step 2: Find user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      console.log("❌ User not found")
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }
    console.log("✅ User found:", user.id)

    // Step 3: Find document
    const document = await prisma.document.findFirst({
      where: { 
        id: params.id,
        taxReturn: {
          userId: user.id
        }
      }
    })

    if (!document) {
      console.log("❌ Document not found for user")
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }
    console.log("✅ Document found:", {
      id: document.id,
      fileName: document.fileName,
      documentType: document.documentType,
      filePath: document.filePath
    })

    // Step 4: Check Azure configuration
    console.log("4. Checking Azure Document Intelligence configuration...")
    const hasAzureConfig = !!(
      process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT && 
      process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY
    )

    console.log("Azure configuration check:", {
      hasAzureConfig,
      endpoint: process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT ? "✅ Set" : "❌ Missing"
    })

    if (!hasAzureConfig) {
      console.log("❌ Azure Document Intelligence not configured")
      return NextResponse.json(
        { error: "Azure Document Intelligence service not configured" }, 
        { status: 500 }
      )
    }

    // Step 5: Update status to processing
    console.log("5. Updating status to PROCESSING...")
    await prisma.document.update({
      where: { id: params.id },
      data: { 
        processingStatus: 'PROCESSING',
        updatedAt: new Date()
      }
    })
    console.log("✅ Status updated")

    // Step 6: Process document with Azure Document Intelligence
    console.log("6. Starting Azure Document Intelligence processing...")
    const extractedTaxData = await processWithAzureDocumentIntelligence(document)
    console.log("✅ Azure Document Intelligence processing successful")

    // Step 7: Save results
    console.log("7. Saving results to database...")
    await prisma.document.update({
      where: { id: params.id },
      data: {
        ocrText: extractedTaxData.ocrText,
        extractedData: {
          documentType: extractedTaxData.documentType,
          ocrText: extractedTaxData.ocrText,
          extractedData: extractedTaxData.extractedData,
          confidence: extractedTaxData.confidence,
          processingMethod: extractedTaxData.processingMethod
        },
        processingStatus: 'COMPLETED',
        updatedAt: new Date()
      }
    })
    console.log("✅ Results saved")

    // Step 8: Return results
    return NextResponse.json({
      success: true,
      message: "Document processed successfully with Azure",
      processingMethod: extractedTaxData.processingMethod,
      documentType: extractedTaxData.documentType,
      confidence: extractedTaxData.confidence,
      extractedData: extractedTaxData.extractedData,
      ocrTextPreview: extractedTaxData.ocrText?.substring(0, 500) + "..."
    })

  } catch (error) {
    console.error("=== DOCUMENT PROCESSING ERROR ===")
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    const errorStack = error instanceof Error ? error.stack?.substring(0, 1000) : 'No stack trace'
    console.error("Error:", errorMessage)
    console.error("Stack:", errorStack)
    
    // Update status to failed
    try {
      await prisma.document.update({
        where: { id: params.id },
        data: { processingStatus: 'FAILED' }
      })
    } catch (updateError) {
      const updateErrorMessage = updateError instanceof Error ? updateError.message : 'Unknown update error'
      console.error("Failed to update status:", updateErrorMessage)
    }

    return NextResponse.json(
      { 
        error: "Document processing failed",
        details: errorMessage
      },
      { status: 500 }
    )
  }
}

// Azure Document Intelligence processing function
async function processWithAzureDocumentIntelligence(document: any): Promise<ExtractedTaxData> {
  console.log("processWithAzureDocumentIntelligence: Starting...")
  
  try {
    // Initialize Azure Document Intelligence service
    const azureConfig = createAzureDocumentConfig()
    const azureService = new AzureDocumentService(azureConfig)
    
    console.log("processWithAzureDocumentIntelligence: Azure service initialized")
    
    // Check if file exists
    const { existsSync } = await import("fs")
    if (!existsSync(document.filePath)) {
      throw new Error(`File not found: ${document.filePath}`)
    }
    
    console.log("processWithAzureDocumentIntelligence: File exists, processing...")
    
    // Process document with Azure
    const result = await azureService.processDocument(document.filePath, document.documentType)
    
    console.log("processWithAzureDocumentIntelligence: Azure processing successful")
    console.log("Extracted data keys:", Object.keys(result.extractedData))
    console.log("OCR text length:", result.ocrText.length)
    console.log("Confidence:", result.confidence)
    
    // Enhanced fallback extraction if Azure didn't extract enough
    if (Object.keys(result.extractedData).length < 3 && result.ocrText) {
      console.log("processWithAzureDocumentIntelligence: Enhancing with fallback extraction...")
      
      const fallbackData = performFallbackExtraction(result.ocrText, document.documentType)
      
      // Merge Azure results with fallback
      result.extractedData = {
        ...result.extractedData,
        ...fallbackData
      }
      
      console.log("processWithAzureDocumentIntelligence: Enhanced data keys:", Object.keys(result.extractedData))
    }
    
    return {
      documentType: document.documentType,
      ocrText: result.ocrText,
      extractedData: result.extractedData,
      confidence: result.confidence,
      processingMethod: 'azure_document_intelligence'
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    console.error("processWithAzureDocumentIntelligence: Error:", errorMessage)
    throw new Error(`Azure Document Intelligence processing failed: ${errorMessage}`)
  }
}

// Fallback extraction using regex patterns (same as before but simplified)
function performFallbackExtraction(ocrText: string, documentType: string): any {
  console.log("performFallbackExtraction: Starting fallback extraction...")
  
  const extractedData: any = {}
  
  try {
    // Employee/Recipient Name - Look for proper names
    const namePattern = /\b([A-Z][a-z]{2,15})\s+([A-Z][a-z]{2,15})\b/g
    const nameMatches = [...ocrText.matchAll(namePattern)]
    
    for (const match of nameMatches) {
      const firstName = match[1]
      const lastName = match[2]
      const excludeWords = ['Employee', 'Employer', 'Federal', 'Social', 'Security', 'Medicare', 'Control', 'Wages', 'Income', 'State']
      
      if (!excludeWords.includes(firstName) && !excludeWords.includes(lastName)) {
        extractedData.employeeName = `${firstName} ${lastName}`
        console.log("Fallback: Found employee name:", extractedData.employeeName)
        break
      }
    }
    
    // Employer Name - Look for company names
    const companyPattern = /\b([A-Z][A-Za-z\s,.'&-]{5,40}(?:Company|Corp|Corporation|LLC|Inc|Group|Associates|Partners|Enterprises|Solutions|Services|Industries))\b/i
    const companyMatch = ocrText.match(companyPattern)
    if (companyMatch && companyMatch[1]) {
      extractedData.employerName = companyMatch[1].trim()
      console.log("Fallback: Found employer name:", extractedData.employerName)
    }
    
    // Wages - Context-based extraction
    const wagePattern = /Wages,?\s*tips,?\s*other\s*compensation\s*[^0-9]*([0-9,]+\.?[0-9]*)/i
    const wageMatch = ocrText.match(wagePattern)
    if (wageMatch && wageMatch[1]) {
      const amount = parseFloat(wageMatch[1].replace(/,/g, ''))
      if (!isNaN(amount) && amount >= 1000 && amount <= 1000000) {
        extractedData.wages = amount.toString()
        console.log("Fallback: Found wages:", extractedData.wages)
      }
    }
    
    // Federal Tax Withheld
    const fedTaxPattern = /Federal\s*income\s*tax\s*withheld\s*[^0-9]*([0-9,]+\.?[0-9]*)/i
    const fedTaxMatch = ocrText.match(fedTaxPattern)
    if (fedTaxMatch && fedTaxMatch[1]) {
      const amount = parseFloat(fedTaxMatch[1].replace(/,/g, ''))
      if (!isNaN(amount) && amount >= 0 && amount <= 100000) {
        extractedData.federalTaxWithheld = amount.toString()
        console.log("Fallback: Found federal tax:", extractedData.federalTaxWithheld)
      }
    }
    
    // EIN - XX-XXXXXXX pattern
    const einPattern = /\b(\d{2}-\d{7})\b/
    const einMatch = ocrText.match(einPattern)
    if (einMatch && einMatch[1]) {
      extractedData.employerEIN = einMatch[1]
      console.log("Fallback: Found EIN:", extractedData.employerEIN)
    }
    
    // SSN - XXX-XX-XXXX pattern
    const ssnPattern = /\b(\d{3}-\d{2}-\d{4})\b/
    const ssnMatch = ocrText.match(ssnPattern)
    if (ssnMatch && ssnMatch[1]) {
      extractedData.employeeSSN = ssnMatch[1]
      console.log("Fallback: Found SSN:", extractedData.employeeSSN)
    }
    
    console.log("performFallbackExtraction: Completed")
    
  } catch (error) {
    console.error("performFallbackExtraction: Error:", error)
  }
  
  return extractedData
}
