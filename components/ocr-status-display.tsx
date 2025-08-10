

"use client"

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { 
  FileText, 
  Eye, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  FileImage,
  Loader2,
  Brain
} from 'lucide-react'

interface OCRStatusDisplayProps {
  fileName: string
  fileType: string
  status: 'processing' | 'completed' | 'error'
  progress: number
  message?: string
  extractedData?: any
  ocrText?: string
  onPreview?: () => void
  onContinue?: () => void
}

export function OCRStatusDisplay({
  fileName,
  fileType,
  status,
  progress,
  message = '',
  extractedData,
  ocrText,
  onPreview,
  onContinue
}: OCRStatusDisplayProps) {
  const [activeTab, setActiveTab] = useState('extracted')

  const getStatusIcon = () => {
    switch (status) {
      case 'processing':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case 'processing':
        return 'border-blue-200 bg-blue-50'
      case 'completed':
        return 'border-green-200 bg-green-50'
      case 'error':
        return 'border-red-200 bg-red-50'
    }
  }

  const getFileIcon = () => {
    if (fileType?.toLowerCase() === 'pdf') {
      return <FileText className="h-5 w-5 text-red-500" />
    }
    return <FileImage className="h-5 w-5 text-blue-500" />
  }

  return (
    <div className="space-y-6">
      {/* Processing Status Card */}
      <Card className={getStatusColor()}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {getStatusIcon()}
              <div>
                <div className="flex items-center space-x-2">
                  {getFileIcon()}
                  <span>{fileName}</span>
                </div>
                <p className="text-sm text-gray-600 font-normal">
                  {status === 'processing' && 'AI is analyzing your document...'}
                  {status === 'completed' && 'Document analysis complete!'}
                  {status === 'error' && 'Error processing document'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant={status === 'completed' ? 'default' : 'secondary'}>
                <Brain className="h-3 w-3 mr-1" />
                LLM OCR
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {status === 'processing' && (
            <div className="space-y-3">
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-gray-600">{message}</p>
            </div>
          )}
          
          {status === 'error' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {message || 'Failed to process document. Please try again or upload a different file.'}
              </AlertDescription>
            </Alert>
          )}
          
          {status === 'completed' && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Successfully extracted tax information from your document! 
                {extractedData?.totalRows && ` Found ${extractedData.totalRows} data entries.`}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Extracted Data Display */}
      {status === 'completed' && extractedData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Extracted Tax Data</span>
            </CardTitle>
            <CardDescription>
              Review the information extracted from your document before mapping to tax forms
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="extracted">Extracted Data</TabsTrigger>
                <TabsTrigger value="preview">Data Preview</TabsTrigger>
                <TabsTrigger value="raw">OCR Text</TabsTrigger>
              </TabsList>
              
              <TabsContent value="extracted" className="mt-4">
                <div className="space-y-4">
                  {extractedData?.preview?.[0] && (
                    <div className="bg-white p-4 rounded-lg border">
                      <h4 className="font-medium text-sm text-gray-700 mb-3">Key Information Found:</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        {Object.entries(extractedData.preview[0]).map(([key, value]) => {
                          if (key === 'sourceType' || key === 'extractedAt' || key === 'confidence') return null
                          
                          return (
                            <div key={key} className="flex justify-between">
                              <span className="text-gray-600 capitalize">
                                {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:
                              </span>
                              <span className="font-medium">
                                {typeof value === 'string' && /^\d+\.?\d*$/.test(value) 
                                  ? `$${parseFloat(value).toLocaleString()}`
                                  : String(value || 'N/A')
                                }
                              </span>
                            </div>
                          )
                        })}
                      </div>
                      
                      {extractedData.preview[0].confidence && (
                        <div className="mt-3 pt-3 border-t">
                          <Badge variant="outline" className="text-xs">
                            <Brain className="h-3 w-3 mr-1" />
                            Confidence: {extractedData.preview[0].confidence}
                          </Badge>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {extractedData?.totalRows > 1 && (
                    <Alert>
                      <Eye className="h-4 w-4" />
                      <AlertDescription>
                        This document contains {extractedData.totalRows} data entries. 
                        You can review all entries in the mapping interface.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="preview" className="mt-4">
                <div className="overflow-x-auto">
                  {extractedData?.preview && extractedData.preview.length > 0 ? (
                    <table className="w-full border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-muted">
                          {Object.keys(extractedData.preview[0]).map((header) => (
                            <th 
                              key={header} 
                              className="border border-gray-300 px-4 py-2 text-left font-medium text-sm"
                            >
                              {header.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {extractedData.preview.slice(0, 3).map((row: any, index: number) => (
                          <tr key={index} className="hover:bg-muted/50">
                            {Object.values(row).map((value: any, cellIndex: number) => (
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
                  ) : (
                    <p className="text-gray-500">No preview data available</p>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="raw" className="mt-4">
                <div className="bg-gray-50 p-4 rounded-lg max-h-60 overflow-y-auto">
                  <p className="text-sm font-mono whitespace-pre-wrap">
                    {ocrText || 'No OCR text available'}
                  </p>
                </div>
              </TabsContent>
            </Tabs>
            
            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 mt-4 pt-4 border-t">
              {onPreview && (
                <Button variant="outline" onClick={onPreview}>
                  <Eye className="h-4 w-4 mr-2" />
                  Preview Document
                </Button>
              )}
              {onContinue && (
                <Button onClick={onContinue}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Continue to Mapping
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
