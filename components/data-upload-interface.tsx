
"use client"

import { useState, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Upload,
  FileText,
  AlertCircle,
  CheckCircle,
  Download,
  Eye,
  Trash2,
  FileSpreadsheet,
  FileType,
  FileImage
} from 'lucide-react'
import { toast } from 'sonner'
import { OCRStatusDisplay } from '@/components/ocr-status-display'

interface DataUploadInterfaceProps {
  taxReturnId?: string
  onUploadComplete?: (uploadData: any) => void
  onMappingStart?: (uploadData: any) => void
}

interface UploadData {
  id: string
  fileName: string
  fileType: string
  fileSize: number
  totalRows: number
  status: string
  previewData?: any[]
  createdAt: string
}

export function DataUploadInterface({ 
  taxReturnId, 
  onUploadComplete, 
  onMappingStart 
}: DataUploadInterfaceProps) {
  const [uploads, setUploads] = useState<UploadData[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [dragActive, setDragActive] = useState(false)
  const [selectedUpload, setSelectedUpload] = useState<UploadData | null>(null)
  const [previewData, setPreviewData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // OCR processing state
  const [ocrProcessing, setOcrProcessing] = useState(false)
  const [ocrStatus, setOcrStatus] = useState<'processing' | 'completed' | 'error'>('processing')
  const [ocrMessage, setOcrMessage] = useState('')
  const [ocrData, setOcrData] = useState<any>(null)
  const [currentOcrFile, setCurrentOcrFile] = useState<File | null>(null)

  // Fetch existing uploads
  const fetchUploads = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (taxReturnId) params.append('taxReturnId', taxReturnId)
      
      const response = await fetch(`/api/data-upload?${params}`)
      if (response.ok) {
        const data = await response.json()
        setUploads(data.uploads)
      }
    } catch (error) {
      toast.error('Failed to fetch uploads')
    } finally {
      setLoading(false)
    }
  }

  // Handle file upload
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    const file = files[0]
    
    // Validate file type - now includes PDF and images
    const allowedTypes = ['csv', 'xlsx', 'xls', 'json', 'pdf', 'png', 'jpg', 'jpeg', 'tiff', 'tif', 'bmp']
    const fileType = file.name.split('.').pop()?.toLowerCase()
    
    if (!fileType || !allowedTypes.includes(fileType)) {
      toast.error('Please upload a CSV, Excel, JSON, PDF, or image file (PNG, JPG, TIFF, BMP)')
      return
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB')
      return
    }

    setUploading(true)
    setUploadProgress(0)

    try {
      const formData = new FormData()
      formData.append('file', file)
      if (taxReturnId) formData.append('taxReturnId', taxReturnId)

      // Determine if this is a document that needs OCR processing
      const needsOCR = ['pdf', 'png', 'jpg', 'jpeg', 'tiff', 'tif', 'bmp'].includes(fileType)
      
      if (needsOCR) {
        // Use document processing with LLM-based OCR
        await handleDocumentUpload(file, formData)
      } else {
        // Use traditional structured data upload
        await handleStructuredDataUpload(formData)
      }
    } catch (error) {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  // Handle structured data upload (CSV, Excel, JSON)
  const handleStructuredDataUpload = async (formData: FormData) => {
    const response = await fetch('/api/data-upload', {
      method: 'POST',
      body: formData
    })

    if (response.ok) {
      const data = await response.json()
      setUploads(prev => [data.upload, ...prev])
      setPreviewData(data.preview || [])
      setSelectedUpload(data.upload)
      toast.success('File uploaded successfully!')
      onUploadComplete?.(data.upload)
    } else {
      const error = await response.json()
      toast.error(error.error || 'Upload failed')
    }
  }

  // Handle document upload with OCR processing
  const handleDocumentUpload = async (file: File, formData: FormData) => {
    setUploadProgress(20)
    setOcrProcessing(true)
    setOcrStatus('processing')
    setOcrMessage('Uploading document...')
    setCurrentOcrFile(file)
    
    // First upload the document
    const uploadResponse = await fetch('/api/data-upload/document', {
      method: 'POST',
      body: formData
    })

    if (!uploadResponse.ok) {
      const error = await uploadResponse.json()
      throw new Error(error.error || 'Document upload failed')
    }

    const uploadData = await uploadResponse.json()
    setUploadProgress(40)
    setOcrMessage('Starting AI analysis...')
    
    // Process with LLM OCR and get streaming response
    const processResponse = await fetch(`/api/data-upload/document/${uploadData.id}/process`, {
      method: 'POST'
    })

    if (!processResponse.ok) {
      setOcrStatus('error')
      setOcrMessage('Document processing failed')
      throw new Error('Document processing failed')
    }

    // Handle streaming response
    await handleStreamingResponse(processResponse, uploadData)
  }

  // Handle streaming LLM response
  const handleStreamingResponse = async (response: Response, uploadData: any) => {
    const reader = response?.body?.getReader()
    if (!reader) {
      throw new Error('No response body available')
    }

    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        let lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') {
              setUploadProgress(100)
              return
            }
            
            try {
              const parsed = JSON.parse(data)
              if (parsed?.status === 'processing') {
                setUploadProgress(prev => Math.min(prev + 5, 90))
                setOcrMessage(parsed?.message || 'Processing document...')
              } else if (parsed?.status === 'completed') {
                const finalUpload = {
                  ...uploadData,
                  status: 'COMPLETED',
                  previewData: parsed?.preview || [],
                  totalRows: parsed?.totalRows || 0
                }
                setUploads(prev => [finalUpload, ...prev])
                setPreviewData(parsed?.preview || [])
                setSelectedUpload(finalUpload)
                setUploadProgress(100)
                setOcrStatus('completed')
                setOcrMessage('Document processed successfully!')
                setOcrData(parsed)
                toast.success('Document processed successfully!')
                onUploadComplete?.(finalUpload)
                return
              } else if (parsed?.status === 'error') {
                setOcrStatus('error')
                setOcrMessage(parsed?.message || 'Processing failed')
                throw new Error(parsed?.message || 'Processing failed')
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  // Handle drag events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files) {
      handleFileUpload(e.dataTransfer.files)
    }
  }

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Get file type icon
  const getFileIcon = (fileType: string) => {
    switch (fileType.toLowerCase()) {
      case 'csv':
        return <FileText className="h-4 w-4" />
      case 'xlsx':
      case 'xls':
        return <FileSpreadsheet className="h-4 w-4" />
      case 'json':
        return <FileType className="h-4 w-4" />
      case 'pdf':
        return <FileText className="h-4 w-4 text-red-500" />
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'tiff':
      case 'tif':
      case 'bmp':
        return <FileImage className="h-4 w-4 text-blue-500" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Tax Form Data
          </CardTitle>
          <CardDescription>
            Upload structured data files (CSV, Excel, JSON) or documents with OCR processing (PDF, images of W-2, 1099 forms, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive 
                ? 'border-primary bg-primary/5' 
                : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 rounded-full bg-muted">
                <Upload className="h-8 w-8 text-muted-foreground" />
              </div>
              
              {uploading ? (
                <div className="w-full max-w-xs space-y-2">
                  <Progress value={uploadProgress} />
                  <p className="text-sm text-muted-foreground">Uploading...</p>
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-lg font-medium">Drag and drop files here</p>
                    <p className="text-sm text-muted-foreground">
                      or click to browse files
                    </p>
                  </div>
                  
                  <Button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Choose Files
                  </Button>
                </>
              )}
              
              <div className="flex flex-wrap gap-2 justify-center">
                <Badge variant="secondary">CSV</Badge>
                <Badge variant="secondary">Excel</Badge>
                <Badge variant="secondary">JSON</Badge>
                <Badge variant="outline">PDF</Badge>
                <Badge variant="outline">PNG</Badge>
                <Badge variant="outline">JPG</Badge>
                <Badge variant="outline">TIFF</Badge>
              </div>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.json,.pdf,.png,.jpg,.jpeg,.tiff,.tif,.bmp"
              onChange={(e) => handleFileUpload(e.target.files)}
              className="hidden"
            />
          </div>
        </CardContent>
      </Card>

      {/* OCR Processing Display */}
      {ocrProcessing && currentOcrFile && (
        <OCRStatusDisplay
          fileName={currentOcrFile.name}
          fileType={currentOcrFile.name.split('.').pop() || ''}
          status={ocrStatus}
          progress={uploadProgress}
          message={ocrMessage}
          extractedData={ocrData}
          ocrText={ocrData?.ocrTextPreview}
          onContinue={() => {
            setOcrProcessing(false)
            setCurrentOcrFile(null)
            // Optionally start mapping process
          }}
        />
      )}

      {/* Uploaded Files List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Uploaded Files
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchUploads}
              disabled={loading}
            >
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {uploads.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No files uploaded yet</p>
              <p className="text-sm">Upload your first tax data file to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {uploads.map((upload) => (
                <div
                  key={upload.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      {getFileIcon(upload.fileType)}
                      <div>
                        <p className="font-medium">{upload.fileName}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatFileSize(upload.fileSize)} • {upload.totalRows} rows • 
                          {new Date(upload.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={upload.status === 'COMPLETED' ? 'default' : 
                               upload.status === 'FAILED' ? 'destructive' : 'secondary'}
                    >
                      {upload.status === 'COMPLETED' && <CheckCircle className="h-3 w-3 mr-1" />}
                      {upload.status === 'FAILED' && <AlertCircle className="h-3 w-3 mr-1" />}
                      {upload.status}
                    </Badge>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedUpload(upload)
                        setPreviewData(upload.previewData || [])
                      }}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Preview
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onMappingStart?.(upload)}
                      disabled={upload.status !== 'COMPLETED'}
                    >
                      Map Fields
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Preview */}
      {selectedUpload && previewData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Data Preview - {selectedUpload.fileName}
            </CardTitle>
            <CardDescription>
              Showing first 5 rows of your uploaded data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-muted">
                    {Object.keys(previewData[0] || {}).map((header) => (
                      <th 
                        key={header} 
                        className="border border-gray-300 px-4 py-2 text-left font-medium"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.slice(0, 5).map((row, index) => (
                    <tr key={index} className="hover:bg-muted/50">
                      {Object.values(row).map((value, cellIndex) => (
                        <td 
                          key={cellIndex} 
                          className="border border-gray-300 px-4 py-2 text-sm"
                        >
                          {String(value || '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {previewData.length > 5 && (
              <Alert className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Showing 5 of {selectedUpload.totalRows} total rows. 
                  Complete the field mapping to process all data.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
