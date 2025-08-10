
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'
import { parseUploadedFile } from '@/lib/data-processing'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

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

    const formData = await req.formData()
    const file = formData.get('file') as File
    const taxReturnId = formData.get('taxReturnId') as string

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    // Parse the uploaded file
    const parseResult = await parseUploadedFile(file)
    
    if (!parseResult.success) {
      return NextResponse.json({ 
        error: parseResult.error 
      }, { status: 400 })
    }

    // Save file to uploads directory
    const uploadDir = path.join(process.cwd(), 'uploads')
    await mkdir(uploadDir, { recursive: true })
    
    const fileName = `${Date.now()}-${file.name}`
    const filePath = path.join(uploadDir, fileName)
    
    const bytes = await file.arrayBuffer()
    await writeFile(filePath, Buffer.from(bytes))

    // Save upload record to database
    const dataUpload = await prisma.dataUpload.create({
      data: {
        userId: user.id,
        taxReturnId: taxReturnId || null,
        fileName: file.name,
        fileType: file.name.split('.').pop()?.toUpperCase() || 'UNKNOWN',
        fileSize: file.size,
        filePath: fileName, // Store relative path
        totalRows: parseResult.totalRows || 0,
        previewData: parseResult.preview || [],
        status: 'COMPLETED'
      }
    })

    return NextResponse.json({
      success: true,
      upload: dataUpload,
      preview: parseResult.preview,
      headers: parseResult.headers,
      totalRows: parseResult.totalRows
    })

  } catch (error) {
    console.error('Upload error:', error)
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
    const taxReturnId = searchParams.get('taxReturnId')

    const uploads = await prisma.dataUpload.findMany({
      where: {
        userId: user.id,
        ...(taxReturnId && { taxReturnId })
      },
      orderBy: { createdAt: 'desc' },
      include: {
        mappings: {
          select: {
            id: true,
            mappingName: true,
            status: true
          }
        }
      }
    })

    return NextResponse.json({ uploads })

  } catch (error) {
    console.error('Get uploads error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}
