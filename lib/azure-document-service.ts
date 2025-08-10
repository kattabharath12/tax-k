import { DocumentAnalysisClient, AzureKeyCredential } from "@azure/ai-form-recognizer"
import { readFile } from 'fs/promises'

export interface AzureDocumentConfig {
  endpoint: string
  key: string
}

export interface ExtractedTaxData {
  documentType: string
  ocrText: string
  extractedData: any
  confidence: number
}

export class AzureDocumentService {
  private client: DocumentAnalysisClient
  private config: AzureDocumentConfig

  constructor(config: AzureDocumentConfig) {
    this.config = config
    this.client = new DocumentAnalysisClient(
      config.endpoint,
      new AzureKeyCredential(config.key)
    )
  }

  async processDocument(filePath: string, documentType: string): Promise<ExtractedTaxData> {
    try {
      // Read the document file
      const documentBuffer = await readFile(filePath)

      // Use prebuilt models for tax documents
      const modelId = this.getModelId(documentType)
      
      const poller = await this.client.beginAnalyzeDocument(modelId, documentBuffer)
      const result = await poller.pollUntilDone()

      return this.transformToTaxData(result, documentType)
    } catch (error) {
      console.error('Error processing document with Azure:', error)
      throw error
    }
  }

  private getModelId(documentType: string): string {
    switch (documentType) {
      case 'W2':
        return 'prebuilt-tax.us.w2' // Azure prebuilt W-2 model
      case 'FORM_1099_NEC':
      case 'FORM_1099_MISC':
      case 'FORM_1099_INT':
      case 'FORM_1099_DIV':
        return 'prebuilt-tax.us.1099' // Azure prebuilt 1099 models
      default:
        return 'prebuilt-document' // General document model
    }
  }

  private transformToTaxData(result: any, documentType: string): ExtractedTaxData {
    const extractedData: any = {}
    let averageConfidence = 0
    let confidenceCount = 0

    // Extract fields from Azure result
    if (result.documents && result.documents[0]) {
      const document = result.documents[0]
      
      // Process based on document type
      switch (documentType) {
        case 'W2':
          extractedData.employerName = this.getFieldValue(document, 'EmployerName')
          extractedData.employerEIN = this.getFieldValue(document, 'EmployerIdNumber')
          extractedData.employeeName = this.getFieldValue(document, 'Employee.Name')
          extractedData.employeeSSN = this.getFieldValue(document, 'Employee.SocialSecurityNumber')
          extractedData.wages = this.getFieldValue(document, 'WagesTipsOtherCompensation')
          extractedData.federalTaxWithheld = this.getFieldValue(document, 'FederalIncomeTaxWithheld')
          extractedData.socialSecurityWages = this.getFieldValue(document, 'SocialSecurityWages')
          extractedData.socialSecurityTaxWithheld = this.getFieldValue(document, 'SocialSecurityTaxWithheld')
          extractedData.medicareWages = this.getFieldValue(document, 'MedicareWagesAndTips')
          extractedData.medicareTaxWithheld = this.getFieldValue(document, 'MedicareTaxWithheld')
          break

        case 'FORM_1099_INT':
          extractedData.payerName = this.getFieldValue(document, 'PayerName')
          extractedData.payerTIN = this.getFieldValue(document, 'PayerTaxIdNumber')
          extractedData.recipientName = this.getFieldValue(document, 'RecipientName')
          extractedData.recipientTIN = this.getFieldValue(document, 'RecipientTaxIdNumber')
          extractedData.interestIncome = this.getFieldValue(document, 'InterestIncome')
          extractedData.federalTaxWithheld = this.getFieldValue(document, 'FederalIncomeTaxWithheld')
          break

        case 'FORM_1099_NEC':
          extractedData.payerName = this.getFieldValue(document, 'PayerName')
          extractedData.payerTIN = this.getFieldValue(document, 'PayerTaxIdNumber')
          extractedData.recipientName = this.getFieldValue(document, 'RecipientName')
          extractedData.recipientTIN = this.getFieldValue(document, 'RecipientTaxIdNumber')
          extractedData.nonemployeeCompensation = this.getFieldValue(document, 'NonemployeeCompensation')
          extractedData.federalTaxWithheld = this.getFieldValue(document, 'FederalIncomeTaxWithheld')
          break

        default:
          // Extract general document fields
          if (document.fields) {
            Object.keys(document.fields).forEach(key => {
              extractedData[key] = this.getFieldValue(document, key)
            })
          }
      }

      // Calculate average confidence
      if (document.fields) {
        const fields = Object.values(document.fields)
        confidenceCount = fields.length
        averageConfidence = fields.reduce((sum: number, field: any) => 
          sum + (field.confidence || 0), 0) / confidenceCount
      }
    }

    // Get OCR text
    const ocrText = result.content || ''

    return {
      documentType,
      ocrText,
      extractedData,
      confidence: averageConfidence || 0.85
    }
  }

  private getFieldValue(document: any, fieldName: string): string {
    const field = document.fields?.[fieldName]
    if (!field) return ''
    
    // Handle different field types
    if (field.kind === 'string') return field.value || ''
    if (field.kind === 'number') return field.value?.toString() || ''
    if (field.kind === 'currency') return field.value?.amount?.toString() || ''
    
    return field.content || ''
  }
}

// Configuration helper
export function createAzureDocumentConfig(): AzureDocumentConfig {
  const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT
  const key = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY

  if (!endpoint || !key) {
    throw new Error('Missing Azure Document Intelligence configuration. Please set AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT and AZURE_DOCUMENT_INTELLIGENCE_KEY environment variables.')
  }

  return { endpoint, key }
}
