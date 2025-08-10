// Create this as: app/api/simple-check/route.ts
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const { documentId } = await request.json()
    
    const document = await prisma.document.findUnique({
      where: { id: documentId }
    })
    
    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }
    
    return NextResponse.json({
      id: document.id,
      processingStatus: document.processingStatus,
      hasOcrText: !!document.ocrText,
      hasExtractedData: !!document.extractedData,
      updatedAt: document.updatedAt
    })
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
