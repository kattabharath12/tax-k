
"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  FileText,
  Upload,
  MapPin,
  Download,
  Plus,
  Eye,
  CheckCircle,
  AlertCircle,
  Clock,
  BarChart3
} from 'lucide-react'
import { DataUploadInterface } from './data-upload-interface'
import { DataMappingInterface } from './data-mapping-interface'
import { toast } from 'sonner'

interface TaxFormsManagementProps {
  taxReturnId: string
  onFormsImported?: (count: number) => void
}

interface ImportSummary {
  totalUploads: number
  totalMappings: number
  totalProcessed: number
  recentActivity: any[]
}

export function TaxFormsManagement({ taxReturnId, onFormsImported }: TaxFormsManagementProps) {
  const [activeTab, setActiveTab] = useState('upload')
  const [selectedUpload, setSelectedUpload] = useState<any>(null)
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchImportSummary()
  }, [taxReturnId])

  // Fetch import summary and statistics
  const fetchImportSummary = async () => {
    try {
      setLoading(true)
      
      // Fetch uploads
      const uploadsResponse = await fetch(`/api/data-upload?taxReturnId=${taxReturnId}`)
      const uploadsData = uploadsResponse.ok ? await uploadsResponse.json() : { uploads: [] }
      
      // Fetch mappings
      const mappingsResponse = await fetch('/api/data-mapping')
      const mappingsData = mappingsResponse.ok ? await mappingsResponse.json() : { mappings: [] }
      
      // Fetch income entries for this tax return
      const entriesResponse = await fetch(`/api/tax-returns/${taxReturnId}/income`)
      const entriesData = entriesResponse.ok ? await entriesResponse.json() : { entries: [] }

      const summary: ImportSummary = {
        totalUploads: uploadsData.uploads?.length || 0,
        totalMappings: mappingsData.mappings?.length || 0,
        totalProcessed: entriesData.entries?.length || 0,
        recentActivity: [
          ...uploadsData.uploads?.slice(0, 3) || [],
          ...mappingsData.mappings?.slice(0, 3) || []
        ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      }

      setImportSummary(summary)
    } catch (error) {
      console.error('Failed to fetch import summary:', error)
    } finally {
      setLoading(false)
    }
  }

  // Handle successful upload
  const handleUploadComplete = (uploadData: any) => {
    toast.success('File uploaded successfully!')
    fetchImportSummary() // Refresh summary
  }

  // Handle mapping start
  const handleMappingStart = (uploadData: any) => {
    setSelectedUpload(uploadData)
    setActiveTab('mapping')
  }

  // Handle successful mapping/processing
  const handleMappingComplete = (result: any) => {
    toast.success(`Successfully imported ${result.processed} tax forms!`)
    setActiveTab('summary')
    setSelectedUpload(null)
    fetchImportSummary() // Refresh summary
    onFormsImported?.(result.processed)
  }

  // Initialize form templates
  const initializeFormTemplates = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/form-templates', {
        method: 'POST'
      })
      
      if (response.ok) {
        const data = await response.json()
        toast.success(`Initialized ${data.created} form templates`)
        fetchImportSummary()
      } else {
        toast.error('Failed to initialize form templates')
      }
    } catch (error) {
      toast.error('Failed to initialize form templates')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header with Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Files Uploaded
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{importSummary?.totalUploads || 0}</span>
              <Upload className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Field Mappings
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{importSummary?.totalMappings || 0}</span>
              <MapPin className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Forms Processed
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{importSummary?.totalProcessed || 0}</span>
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Button 
              size="sm" 
              className="w-full"
              onClick={initializeFormTemplates}
              disabled={loading}
            >
              <Plus className="h-4 w-4 mr-1" />
              Setup Forms
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Tax Form Data Management
          </CardTitle>
          <CardDescription>
            Upload, map, and process tax form data from various sources
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="upload" className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Upload Data
              </TabsTrigger>
              <TabsTrigger value="mapping" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Map Fields
              </TabsTrigger>
              <TabsTrigger value="summary" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Summary
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="mt-6">
              <DataUploadInterface
                taxReturnId={taxReturnId}
                onUploadComplete={handleUploadComplete}
                onMappingStart={handleMappingStart}
              />
            </TabsContent>

            <TabsContent value="mapping" className="mt-6">
              {selectedUpload ? (
                <DataMappingInterface
                  uploadData={selectedUpload}
                  taxReturnId={taxReturnId}
                  onMappingComplete={handleMappingComplete}
                  onBack={() => {
                    setActiveTab('upload')
                    setSelectedUpload(null)
                  }}
                />
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <MapPin className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No Upload Selected</h3>
                  <p className="mb-4">Please upload a file first, then click "Map Fields" to continue</p>
                  <Button onClick={() => setActiveTab('upload')}>
                    Go to Upload
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="summary" className="mt-6">
              <div className="space-y-6">
                {/* Recent Activity */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Recent Activity</CardTitle>
                    <CardDescription>
                      Latest uploads and processing activities
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!importSummary?.recentActivity || importSummary.recentActivity.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No recent activity</p>
                        <p className="text-sm">Upload your first tax data file to get started</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {importSummary.recentActivity.map((activity, index) => (
                          <div
                            key={`${activity.id}-${index}`}
                            className="flex items-center justify-between p-4 border rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-full bg-muted">
                                {activity.fileName ? (
                                  <Upload className="h-4 w-4" />
                                ) : (
                                  <MapPin className="h-4 w-4" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium">
                                  {activity.fileName || activity.mappingName}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {activity.fileName ? 'File uploaded' : 'Field mapping created'} • 
                                  {new Date(activity.createdAt).toLocaleString()}
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Badge 
                                variant={
                                  activity.status === 'COMPLETED' ? 'default' : 
                                  activity.status === 'FAILED' ? 'destructive' : 'secondary'
                                }
                              >
                                {activity.status === 'COMPLETED' && <CheckCircle className="h-3 w-3 mr-1" />}
                                {activity.status === 'FAILED' && <AlertCircle className="h-3 w-3 mr-1" />}
                                {activity.status || 'Active'}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Processing Statistics */}
                {importSummary && importSummary.totalProcessed > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Import Statistics</CardTitle>
                      <CardDescription>
                        Summary of processed tax form data
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="text-center p-4 border rounded-lg">
                          <div className="text-2xl font-bold text-green-600">
                            {importSummary.totalProcessed}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Total Forms Imported
                          </div>
                        </div>
                        <div className="text-center p-4 border rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">
                            {importSummary.totalUploads}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Files Processed
                          </div>
                        </div>
                        <div className="text-center p-4 border rounded-lg">
                          <div className="text-2xl font-bold text-purple-600">
                            {importSummary.totalMappings}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Mapping Configurations
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Next Steps */}
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Ready for tax calculations!</strong> Your tax form data has been imported. 
                    You can now proceed to review income entries and complete your tax return.
                  </AlertDescription>
                </Alert>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
