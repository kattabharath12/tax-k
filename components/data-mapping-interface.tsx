
"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import {
  MapPin,
  FileText,
  Save,
  Play,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  RefreshCw,
  Settings
} from 'lucide-react'
import { toast } from 'sonner'
import { FORM_DESCRIPTIONS } from '@/lib/form-templates'

interface DataMappingInterfaceProps {
  uploadData: any
  taxReturnId: string
  onMappingComplete?: (result: any) => void
  onBack?: () => void
}

interface FormTemplate {
  id: string
  formType: string
  templateName: string
  formFields: any[]
}

interface FieldMapping {
  sourceField: string
  targetField: string
  required: boolean
}

export function DataMappingInterface({ 
  uploadData, 
  taxReturnId, 
  onMappingComplete, 
  onBack 
}: DataMappingInterfaceProps) {
  const [formTypes, setFormTypes] = useState<any[]>([])
  const [selectedFormType, setSelectedFormType] = useState<string>('')
  const [formTemplate, setFormTemplate] = useState<FormTemplate | null>(null)
  const [sourceFields, setSourceFields] = useState<string[]>([])
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({})
  const [mappingName, setMappingName] = useState('')
  const [isTemplate, setIsTemplate] = useState(false)
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [previewData, setPreviewData] = useState<any[]>([])

  // Fetch form types and preview data on mount
  useEffect(() => {
    fetchFormTypes()
    loadPreviewData()
  }, [])

  // Fetch available form types
  const fetchFormTypes = async () => {
    try {
      const response = await fetch('/api/form-templates')
      if (response.ok) {
        const data = await response.json()
        setFormTypes(data.formTypes)
      }
    } catch (error) {
      toast.error('Failed to load form types')
    }
  }

  // Load preview data from upload
  const loadPreviewData = () => {
    if (uploadData?.previewData && Array.isArray(uploadData.previewData)) {
      setPreviewData(uploadData.previewData)
      
      // Extract source fields from preview data
      if (uploadData.previewData.length > 0) {
        const fields = Object.keys(uploadData.previewData[0])
        setSourceFields(fields)
      }
    }
  }

  // Load form template when form type is selected
  const handleFormTypeChange = async (formType: string) => {
    setSelectedFormType(formType)
    setFieldMappings({}) // Reset mappings
    
    try {
      setLoading(true)
      const response = await fetch(`/api/form-templates?formType=${formType}`)
      if (response.ok) {
        const data = await response.json()
        setFormTemplate(data.template)
        
        // Auto-generate mapping name
        const formDescription = FORM_DESCRIPTIONS[formType as keyof typeof FORM_DESCRIPTIONS] || formType
        setMappingName(`${uploadData.fileName} - ${formDescription}`)
      } else {
        toast.error('Failed to load form template')
      }
    } catch (error) {
      toast.error('Failed to load form template')
    } finally {
      setLoading(false)
    }
  }

  // Update field mapping
  const updateFieldMapping = (targetField: string, sourceField: string) => {
    setFieldMappings(prev => ({
      ...prev,
      [sourceField]: targetField
    }))
  }

  // Remove field mapping
  const removeFieldMapping = (sourceField: string) => {
    setFieldMappings(prev => {
      const updated = { ...prev }
      delete updated[sourceField]
      return updated
    })
  }

  // Auto-suggest mappings based on field names
  const autoSuggestMappings = () => {
    if (!formTemplate || sourceFields.length === 0) return

    const suggestions: Record<string, string> = {}
    const formFields = formTemplate.formFields as any[]

    sourceFields.forEach(sourceField => {
      const sourceLower = sourceField.toLowerCase().replace(/[^a-z0-9]/g, '')
      
      // Find best match in form fields
      const bestMatch = formFields.find(formField => {
        const targetLower = formField.name.toLowerCase().replace(/[^a-z0-9]/g, '')
        const labelLower = formField.label.toLowerCase().replace(/[^a-z0-9]/g, '')
        
        return sourceLower.includes(targetLower) || 
               targetLower.includes(sourceLower) ||
               sourceLower.includes(labelLower) ||
               labelLower.includes(sourceLower)
      })
      
      if (bestMatch) {
        suggestions[sourceField] = bestMatch.name
      }
    })

    setFieldMappings(suggestions)
    toast.success(`Auto-suggested ${Object.keys(suggestions).length} field mappings`)
  }

  // Save mapping configuration
  const saveMapping = async () => {
    if (!selectedFormType || Object.keys(fieldMappings).length === 0) {
      toast.error('Please select a form type and map at least one field')
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/data-mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadId: uploadData.id,
          formType: selectedFormType,
          mappingName,
          fieldMappings,
          isTemplate,
          taxReturnId
        })
      })

      if (response.ok) {
        const data = await response.json()
        toast.success('Mapping configuration saved successfully!')
        return data.mapping
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to save mapping')
      }
    } catch (error) {
      toast.error('Failed to save mapping')
    } finally {
      setLoading(false)
    }
  }

  // Process the mapping and create income entries
  const processMapping = async () => {
    const mapping = await saveMapping()
    if (!mapping) return

    try {
      setProcessing(true)
      const response = await fetch(`/api/data-mapping/${mapping.id}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taxReturnId })
      })

      if (response.ok) {
        const result = await response.json()
        
        if (result.success) {
          toast.success(`Successfully processed ${result.processed} records!`)
          onMappingComplete?.(result)
        } else {
          toast.error(`Processing failed. ${result.errors?.length || 0} errors found.`)
        }
      } else {
        const error = await response.json()
        toast.error(error.error || 'Processing failed')
      }
    } catch (error) {
      toast.error('Processing failed')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              <div>
                <CardTitle>Map Data Fields</CardTitle>
                <CardDescription>
                  Map fields from {uploadData?.fileName} to tax form fields
                </CardDescription>
              </div>
            </div>
            {onBack && (
              <Button variant="outline" onClick={onBack}>
                Back to Upload
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Panel */}
        <div className="lg:col-span-1 space-y-6">
          {/* Form Type Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Form Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Form Type</Label>
                <Select value={selectedFormType} onValueChange={handleFormTypeChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select form type" />
                  </SelectTrigger>
                  <SelectContent>
                    {formTypes.map(type => (
                      <SelectItem key={type.formType} value={type.formType}>
                        {type.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Mapping Name</Label>
                <Input
                  value={mappingName}
                  onChange={(e) => setMappingName(e.target.value)}
                  placeholder="Enter mapping name"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="saveAsTemplate"
                  checked={isTemplate}
                  onCheckedChange={(checked) => setIsTemplate(checked as boolean)}
                />
                <Label htmlFor="saveAsTemplate" className="text-sm">
                  Save as reusable template
                </Label>
              </div>

              {selectedFormType && (
                <Button
                  onClick={autoSuggestMappings}
                  variant="outline"
                  className="w-full"
                  disabled={loading}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Auto-Suggest Mappings
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Upload Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Upload Info</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">File:</span>
                  <span className="font-medium">{uploadData?.fileName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rows:</span>
                  <span className="font-medium">{uploadData?.totalRows}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type:</span>
                  <Badge variant="secondary">{uploadData?.fileType}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="space-y-2">
            <Button
              onClick={processMapping}
              disabled={!selectedFormType || Object.keys(fieldMappings).length === 0 || processing}
              className="w-full"
            >
              {processing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Process & Import
                </>
              )}
            </Button>
            
            <Button
              onClick={saveMapping}
              variant="outline"
              disabled={!selectedFormType || Object.keys(fieldMappings).length === 0 || loading}
              className="w-full"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Mapping Only
            </Button>
          </div>
        </div>

        {/* Field Mapping Panel */}
        <div className="lg:col-span-2">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-lg">Field Mappings</CardTitle>
              <CardDescription>
                Map your data columns to tax form fields
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!formTemplate ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select a form type to begin mapping fields</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Mapped Fields */}
                  {Object.entries(fieldMappings).map(([sourceField, targetField]) => {
                    const formField = formTemplate.formFields.find((f: any) => f.name === targetField)
                    return (
                      <div
                        key={`${sourceField}-${targetField}`}
                        className="flex items-center justify-between p-3 border rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">{sourceField}</Badge>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{formField?.label || targetField}</p>
                            <p className="text-xs text-muted-foreground">
                              {formField?.boxNumber && `Box ${formField.boxNumber}`}
                              {formField?.required && (
                                <Badge variant="destructive" className="ml-2">
                                  Required
                                </Badge>
                              )}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFieldMapping(sourceField)}
                        >
                          Remove
                        </Button>
                      </div>
                    )
                  })}

                  {/* Available Source Fields */}
                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-3">Available Data Columns</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {sourceFields
                        .filter(field => !fieldMappings[field])
                        .map(field => (
                          <div key={field} className="flex items-center justify-between p-2 border rounded">
                            <span className="text-sm">{field}</span>
                            <Select onValueChange={(value) => updateFieldMapping(value, field)}>
                              <SelectTrigger className="w-40">
                                <SelectValue placeholder="Map to..." />
                              </SelectTrigger>
                              <SelectContent>
                                {formTemplate.formFields
                                  .filter((f: any) => !Object.values(fieldMappings).includes(f.name))
                                  .map((field: any) => (
                                    <SelectItem key={field.name} value={field.name}>
                                      {field.label}
                                      {field.required && <span className="text-red-500 ml-1">*</span>}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                    </div>
                  </div>

                  {Object.keys(fieldMappings).length === 0 && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        No field mappings configured. Map your data columns to form fields to continue.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Data Preview */}
      {previewData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Data Preview</CardTitle>
            <CardDescription>
              Preview of mapped data (first 3 rows)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-muted">
                    {Object.keys(fieldMappings).map(sourceField => (
                      <th key={sourceField} className="border border-gray-300 px-4 py-2 text-left">
                        <div>
                          <div className="font-medium">{sourceField}</div>
                          <div className="text-xs text-muted-foreground">
                            → {fieldMappings[sourceField]}
                          </div>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.slice(0, 3).map((row, index) => (
                    <tr key={index} className="hover:bg-muted/50">
                      {Object.keys(fieldMappings).map(sourceField => (
                        <td key={sourceField} className="border border-gray-300 px-4 py-2 text-sm">
                          {String(row[sourceField] || '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
