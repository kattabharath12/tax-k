import { readFile } from 'fs/promises'

export interface SimpleAzureConfig {
  endpoint: string
  key: string
}

export interface ExtractedTaxData {
  documentType: string
  ocrText: string
  extractedData: any
  confidence: number
}

export class SimpleAzureDocumentService {
  private config: SimpleAzureConfig

  constructor(config: SimpleAzureConfig) {
    this.config = config
  }

  async processDocument(filePath: string, documentType: string): Promise<ExtractedTaxData> {
    try {
      console.log('SimpleAzure: Starting document processing...')
      
      // Read the document file
      const documentBuffer = await readFile(filePath)
      console.log('SimpleAzure: File read, size:', documentBuffer.length)
      
      // Convert to base64
      const base64Document = documentBuffer.toString('base64')
      console.log('SimpleAzure: Converted to base64')
      
      // Determine model ID
      const modelId = this.getModelId(documentType)
      console.log('SimpleAzure: Using model:', modelId)
      
      // Call Azure REST API
      const analyzeUrl = `${this.config.endpoint}/formrecognizer/documentModels/${modelId}:analyze?api-version=2023-07-31`
      
      console.log('SimpleAzure: Calling Azure API...')
      const response = await fetch(analyzeUrl, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': this.config.key,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          base64Source: base64Document
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('SimpleAzure: API error response:', errorText)
        throw new Error(`Azure API error: ${response.status} ${response.statusText}`)
      }

      // Get operation location from header
      const operationLocation = response.headers.get('Operation-Location')
      if (!operationLocation) {
        throw new Error('No operation location returned from Azure')
      }

      console.log('SimpleAzure: Analysis started, polling for results...')
      
      // Poll for results
      const result = await this.pollForResults(operationLocation)
      console.log('SimpleAzure: Results received, transforming data...')
      
      const transformedData = this.transformToTaxData(result, documentType)
      console.log('SimpleAzure: Processing complete!')
      
      return transformedData
      
    } catch (error) {
      console.error('SimpleAzure: Processing error:', error)
      
      // Fallback: return basic OCR text if Azure fails
      try {
        const documentBuffer = await readFile(filePath)
        return {
          documentType,
          ocrText: 'Azure processing failed. Manual review required.',
          extractedData: { error: 'Azure API failed', fallback: true },
          confidence: 0.5
        }
      } catch (fallbackError) {
        throw error // Throw original error if even fallback fails
      }
    }
  }

  private async pollForResults(operationLocation: string): Promise<any> {
    const maxAttempts = 30
    const pollInterval = 2000 // 2 seconds
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      console.log(`SimpleAzure: Polling attempt ${attempt + 1}/${maxAttempts}`)
      
      const response = await fetch(operationLocation, {
        headers: {
          'Ocp-Apim-Subscription-Key': this.config.key
        }
      })

      if (!response.ok) {
        throw new Error(`Polling error: ${response.status}`)
      }

      const result = await response.json()
      
      if (result.status === 'succeeded') {
        console.log('SimpleAzure: Analysis completed successfully')
        return result.analyzeResult
      } else if (result.status === 'failed') {
        const errorMsg = result.error?.message || 'Unknown error'
        console.error('SimpleAzure: Analysis failed:', errorMsg)
        throw new Error(`Azure analysis failed: ${errorMsg}`)
      }
      
      console.log(`SimpleAzure: Status: ${result.status}, waiting...`)
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval))
    }
    
    throw new Error('Azure analysis timed out after 60 seconds')
  }

  private getModelId(documentType: string): string {
  switch (documentType) {
    case 'W2':
      return 'prebuilt-tax.us.w2'  // This works perfectly!
    case 'FORM_1099_NEC':
    case 'FORM_1099_MISC':
    case 'FORM_1099_INT':
    case 'FORM_1099_DIV':
    case 'FORM_1099_R':
    case 'FORM_1099_G':
      return 'prebuilt-document'  // Use general model
    default:
      return 'prebuilt-document'
  }
}

  private transformToTaxData(result: any, documentType: string): ExtractedTaxData {
    const extractedData: any = {}
    let averageConfidence = 0
    
    console.log('SimpleAzure: Transforming result data...')
    
    // Extract fields from Azure result
    if (result.documents && result.documents[0]) {
      const document = result.documents[0]
      console.log('SimpleAzure: Found document with fields:', Object.keys(document.fields || {}))
      
      // Process fields based on document type
      if (document.fields) {
        Object.keys(document.fields).forEach(key => {
          const field = document.fields[key]
          
          // Extract value based on field type
          let value = ''
          if (field.valueString) {
            value = field.valueString
          } else if (field.valueNumber !== undefined) {
            value = field.valueNumber.toString()
          } else if (field.content) {
            value = field.content
          }
          
          if (value) {
            // Map Azure field names to our standard names
            const mappedKey = this.mapFieldName(key, documentType)
            extractedData[mappedKey] = value
            console.log(`SimpleAzure: Extracted ${mappedKey}: ${value}`)
          }
        })
        
        // Calculate average confidence
        const confidenceValues = Object.values(document.fields)
          .map((field: any) => field.confidence || 0)
          .filter(conf => conf > 0)
        
        if (confidenceValues.length > 0) {
          averageConfidence = confidenceValues.reduce((sum, conf) => sum + conf, 0) / confidenceValues.length
        }
      }
    }

    // Extract OCR text
    const ocrText = result.content || ''
    console.log('SimpleAzure: OCR text length:', ocrText.length)
    console.log('SimpleAzure: Extracted fields count:', Object.keys(extractedData).length)
    console.log('SimpleAzure: Average confidence:', averageConfidence)

    return {
      documentType,
      ocrText,
      extractedData,
      confidence: averageConfidence || 0.85
    }
  }

  private mapFieldName(azureFieldName: string, documentType: string): string {
    // Map Azure field names to our standard field names
    const mappings: Record<string, string> = {
      // W-2 mappings
      'Employee': 'employeeName',
      'EmployeeName': 'employeeName',
      'Employee.Name': 'employeeName',
      'Employer': 'employerName',
      'EmployerName': 'employerName',
      'Employer.Name': 'employerName',
      'EmployerAddress': 'employerAddress',
      'EmployerAddress.StreetAddress': 'employerAddress',
      'SSN': 'employeeSSN',
      'EmployeeSSN': 'employeeSSN',
      'Employee.SSN': 'employeeSSN',
      'EIN': 'employerEIN',
      'EmployerEIN': 'employerEIN',
      'Employer.EIN': 'employerEIN',
      'W2FormYear': 'taxYear',
      'Wages': 'wages',
      'WagesTipsOtherCompensation': 'wages',
      'FederalIncomeTaxWithheld': 'federalTaxWithheld',
      'SocialSecurityWages': 'socialSecurityWages',
      'SocialSecurityTaxWithheld': 'socialSecurityTaxWithheld',
      'MedicareWagesAndTips': 'medicareWages',
      'MedicareTaxWithheld': 'medicareTaxWithheld',
      
      // 1099 mappings
      'Payer': 'payerName',
      'PayerName': 'payerName',
      'Recipient': 'recipientName',
      'RecipientName': 'recipientName',
      'PayerTIN': 'payerTIN',
      'RecipientTIN': 'recipientTIN',
      'NonemployeeCompensation': 'nonemployeeCompensation',
      'InterestIncome': 'interestIncome',
      'OrdinaryDividends': 'ordinaryDividends',
      'QualifiedDividends': 'qualifiedDividends',
    }
    
    return mappings[azureFieldName] || azureFieldName.toLowerCase()
  }
}

export function createSimpleAzureConfig(): SimpleAzureConfig {
  const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT
  const key = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY

  if (!endpoint || !key) {
    throw new Error('Missing Azure configuration. Please set AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT and AZURE_DOCUMENT_INTELLIGENCE_KEY environment variables.')
  }

  return { endpoint, key }
}
