
import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { lookup } from 'mime-types'
import path from 'path'

interface Props {
  params: {
    filename: string[]
  }
}

export async function GET(req: NextRequest, { params }: Props) {
  try {
    const filename = params.filename.join('/')
    const filePath = path.join(process.cwd(), 'uploads', filename)
    
    // Security check - ensure path is within uploads directory
    const uploadsDir = path.join(process.cwd(), 'uploads')
    const resolvedPath = path.resolve(filePath)
    const resolvedUploadsDir = path.resolve(uploadsDir)
    
    if (!resolvedPath.startsWith(resolvedUploadsDir)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Read the file
    const fileBuffer = await readFile(resolvedPath)
    
    // Get content type
    const mimeType = lookup(filename) || 'application/octet-stream'
    
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `inline; filename="${path.basename(filename)}"`
      }
    })

  } catch (error) {
    if ((error as any)?.code === 'ENOENT') {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
    
    console.error('File serve error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
