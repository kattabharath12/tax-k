
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import { CsvRowData, ExcelRowData, FileProcessingResult, IncomeType, DocumentType } from './types'

export interface UploadResult extends FileProcessingResult {
  preview?: CsvRowData[] | ExcelRowData[]
}

export interface ValidationError {
  row: number
  field: string
  message: string
  value: any
}

export interface ProcessingResult {
  success: boolean
  processed: number
  errors: ValidationError[]
  data?: CsvRowData[] | ExcelRowData[]
}

// Parse uploaded files
export async function parseUploadedFile(file: File): Promise<UploadResult> {
  try {
    const fileType = file.name.split('.').pop()?.toLowerCase()
    
    switch (fileType) {
      case 'csv':
        return await parseCSVFile(file)
      case 'xlsx':
      case 'xls':
        return await parseExcelFile(file)
      case 'json':
        return await parseJSONFile(file)
      case 'pdf':
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'tiff':
      case 'tif':
      case 'bmp':
        return await parseOCRDocument(file)
      default:
        return {
          success: false,
          error: 'Unsupported file type. Please upload CSV, Excel, JSON, PDF, or image files.'
        }
    }
  } catch (error) {
    return {
      success: false,
      error: `Error parsing file: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

// Parse CSV files
async function parseCSVFile(file: File): Promise<UploadResult> {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          resolve({
            success: false,
            error: `CSV parsing errors: ${results.errors.map(e => e.message).join(', ')}`
          })
          return
        }

        const data = results.data as any[]
        const headers = results.meta.fields || []
        
        resolve({
          success: true,
          data,
          headers,
          totalRows: data.length,
          preview: data.slice(0, 5) // First 5 rows for preview
        })
      },
      error: (error) => {
        resolve({
          success: false,
          error: `CSV parsing error: ${error.message}`
        })
      }
    })
  })
}

// Parse Excel files
async function parseExcelFile(file: File): Promise<UploadResult> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        
        // Get first worksheet
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
        
        if (jsonData.length === 0) {
          resolve({
            success: false,
            error: 'Excel file appears to be empty'
          })
          return
        }
        
        // Extract headers from first row
        const headers = jsonData[0] as string[]
        const dataRows = jsonData.slice(1).filter(row => 
          Array.isArray(row) && row.some(cell => cell !== null && cell !== undefined && cell !== '')
        )
        
        // Convert array of arrays to array of objects
        const objectData = (dataRows as any[][]).map((row: any[]) => {
          const obj: any = {}
          headers.forEach((header: string, index: number) => {
            obj[header] = row[index] || null
          })
          return obj
        })
        
        resolve({
          success: true,
          data: objectData,
          headers,
          totalRows: objectData.length,
          preview: objectData.slice(0, 5)
        })
      } catch (error) {
        resolve({
          success: false,
          error: `Excel parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`
        })
      }
    }
    
    reader.onerror = () => {
      resolve({
        success: false,
        error: 'Error reading Excel file'
      })
    }
    
    reader.readAsArrayBuffer(file)
  })
}

// Parse JSON files
async function parseJSONFile(file: File): Promise<UploadResult> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const jsonString = e.target?.result as string
        const jsonData = JSON.parse(jsonString)
        
        // Ensure data is an array
        let data: any[]
        if (Array.isArray(jsonData)) {
          data = jsonData
        } else if (typeof jsonData === 'object' && jsonData !== null) {
          // If it's a single object, wrap in array
          data = [jsonData]
        } else {
          resolve({
            success: false,
            error: 'JSON file must contain an array of objects or a single object'
          })
          return
        }
        
        if (data.length === 0) {
          resolve({
            success: false,
            error: 'JSON file contains no data'
          })
          return
        }
        
        // Extract headers from first object
        const headers = Object.keys(data[0])
        
        resolve({
          success: true,
          data,
          headers,
          totalRows: data.length,
          preview: data.slice(0, 5)
        })
      } catch (error) {
        resolve({
          success: false,
          error: `JSON parsing error: ${error instanceof Error ? error.message : 'Invalid JSON format'}`
        })
      }
    }
    
    reader.onerror = () => {
      resolve({
        success: false,
        error: 'Error reading JSON file'
      })
    }
    
    reader.readAsText(file)
  })
}

// Parse OCR documents (PDFs and images)
async function parseOCRDocument(file: File): Promise<UploadResult> {
  // This function is a placeholder for OCR documents
  // The actual OCR processing happens on the server via the document upload API
  // This function just indicates that OCR processing is needed
  
  return {
    success: false,
    error: 'OCR documents require server-side processing. Please use the document upload API endpoint.'
  }
}

// Process OCR extracted data into structured format
export function processOCRExtractedData(
  extractedData: any[],
  ocrText?: string
): UploadResult {
  try {
    if (!extractedData || extractedData.length === 0) {
      return {
        success: false,
        error: 'No data extracted from document'
      }
    }

    // Process the extracted data
    const processedData = extractedData.map((item: any) => {
      // Clean up the data and ensure consistent field names
      const cleanedItem: any = {}
      
      Object.keys(item).forEach((key: string) => {
        if (item[key] !== null && item[key] !== undefined && item[key] !== '') {
          // Convert monetary values to proper format
          if (typeof item[key] === 'string' && /^\$?[\d,]+\.?\d*$/.test(item[key])) {
            cleanedItem[key] = item[key].replace(/[$,]/g, '')
          } else {
            cleanedItem[key] = item[key]
          }
        }
      })
      
      return cleanedItem
    })

    // Extract headers from the first item
    const headers = Object.keys(processedData[0] || {})
    
    return {
      success: true,
      data: processedData,
      headers,
      totalRows: processedData.length,
      preview: processedData.slice(0, 5)
    }
  } catch (error) {
    return {
      success: false,
      error: `Error processing OCR data: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

// Map OCR extracted fields to standard tax form fields
export function mapOCRFieldsToStandard(data: any): any {
  const fieldMapping: Record<string, string> = {
    // Employee/Recipient information
    'employeeName': 'employeeName',
    'recipientName': 'employeeName',
    'employee_name': 'employeeName',
    'recipient_name': 'employeeName',
    
    // Employer/Payer information  
    'employerName': 'employerName',
    'payerName': 'employerName',
    'employer_name': 'employerName',
    'payer_name': 'employerName',
    'companyName': 'employerName',
    'company_name': 'employerName',
    
    // Tax ID numbers
    'employerEIN': 'employerEIN',
    'payerTIN': 'employerEIN',
    'employer_ein': 'employerEIN',
    'payer_tin': 'employerEIN',
    'ein': 'employerEIN',
    'tin': 'employerEIN',
    
    // Income amounts
    'wages': 'wages',
    'wage': 'wages',
    'salary': 'wages',
    'compensation': 'wages',
    'interestIncome': 'interestIncome',
    'interest_income': 'interestIncome',
    'interest': 'interestIncome',
    'dividendIncome': 'dividendIncome',
    'dividend_income': 'dividendIncome',
    'dividends': 'dividendIncome',
    'nonemployeeCompensation': 'nonemployeeCompensation',
    'nonemployee_compensation': 'nonemployeeCompensation',
    
    // Tax withholdings
    'federalTaxWithheld': 'federalTaxWithheld',
    'federal_tax_withheld': 'federalTaxWithheld',
    'federal_withholding': 'federalTaxWithheld',
    'socialSecurityTaxWithheld': 'socialSecurityTaxWithheld',
    'social_security_tax_withheld': 'socialSecurityTaxWithheld',
    'medicareTaxWithheld': 'medicareTaxWithheld',
    'medicare_tax_withheld': 'medicareTaxWithheld'
  }
  
  const mappedData: any = {}
  
  Object.keys(data).forEach((key: string) => {
    const mappedKey = fieldMapping[key] || key
    mappedData[mappedKey] = data[key]
  })
  
  return mappedData
}

// Validate form data against template
export function validateFormData(
  data: CsvRowData[] | ExcelRowData[], 
  formTemplate: Array<{
    name: string;
    label: string;
    type: 'number' | 'decimal' | 'boolean' | 'text' | 'date' | 'select';
    required: boolean;
  }>, 
  fieldMappings: Record<string, string>
): ProcessingResult {
  const errors: ValidationError[] = []
  const processedData: any[] = []
  
  data.forEach((row, index) => {
    const processedRow: any = {}
    let hasErrors = false
    
    // Process each field mapping
    Object.entries(fieldMappings).forEach(([sourceField, targetField]) => {
      const formField = formTemplate.find(f => f.name === targetField)
      const value = row[sourceField]
      
      if (formField) {
        // Validate required fields
        if (formField.required && (value === null || value === undefined || value === '')) {
          errors.push({
            row: index + 1,
            field: targetField,
            message: `Required field '${formField.label}' is missing`,
            value
          })
          hasErrors = true
          return
        }
        
        // Type validation and conversion
        let processedValue = value
        
        if (value !== null && value !== undefined && value !== '') {
          switch (formField.type) {
            case 'number':
              processedValue = Number(value)
              if (isNaN(processedValue)) {
                errors.push({
                  row: index + 1,
                  field: targetField,
                  message: `'${formField.label}' must be a number`,
                  value
                })
                hasErrors = true
              }
              break
              
            case 'decimal':
              processedValue = parseFloat(String(value).replace(/[$,]/g, ''))
              if (isNaN(processedValue)) {
                errors.push({
                  row: index + 1,
                  field: targetField,
                  message: `'${formField.label}' must be a valid decimal number`,
                  value
                })
                hasErrors = true
              }
              break
              
            case 'boolean':
              processedValue = Boolean(value) || 
                String(value).toLowerCase() === 'true' || 
                String(value).toLowerCase() === 'yes' || 
                String(value) === '1'
              break
              
            case 'text':
              processedValue = String(value).trim()
              break
              
            case 'date':
              processedValue = new Date(value)
              if (isNaN(processedValue.getTime())) {
                errors.push({
                  row: index + 1,
                  field: targetField,
                  message: `'${formField.label}' must be a valid date`,
                  value
                })
                hasErrors = true
              }
              break
              
            case 'select':
              processedValue = String(value).trim()
              break
          }
        }
        
        processedRow[targetField] = processedValue
      }
    })
    
    if (!hasErrors) {
      processedData.push(processedRow)
    }
  })
  
  return {
    success: errors.length === 0,
    processed: processedData.length,
    errors,
    data: processedData
  }
}

// Convert form data to income entries
export function convertToIncomeEntries(
  processedData: (CsvRowData | ExcelRowData)[],
  formType: DocumentType,
  taxReturnId: string
) {
  return processedData.map(data => {
    const baseEntry = {
      taxReturnId,
      incomeType: getIncomeTypeFromForm(formType),
      description: `Imported from ${formType}`,
      amount: 0,
      payerName: (data.payerName as string) || (data.employerName as string) || '',
      payerTIN: (data.payerTIN as string) || (data.employerEIN as string) || '',
      employerName: (data.employerName as string) || '',
      employerEIN: (data.employerEIN as string) || ''
    }
    
    // Form-specific processing
    switch (formType) {
      case 'W2':
        return {
          ...baseEntry,
          incomeType: 'W2_WAGES' as IncomeType,
          amount: Number(data.wages) || 0,
          employerName: (data.employerName as string) || '',
          employerEIN: (data.employerEIN as string) || ''
        }
        
      case 'FORM_1099_NEC':
        return {
          ...baseEntry,
          incomeType: 'NONEMPLOYEE_COMPENSATION' as IncomeType,
          amount: Number(data.nonemployeeCompensation) || 0,
          payerName: (data.payerName as string) || '',
          payerTIN: (data.payerTIN as string) || ''
        }
        
      case 'FORM_1099_INT':
        return {
          ...baseEntry,
          incomeType: 'INTEREST' as IncomeType,
          amount: Number(data.interestIncome) || 0,
          payerName: (data.payerName as string) || '',
          payerTIN: (data.payerTIN as string) || ''
        }
        
      case 'FORM_1099_DIV':
        return {
          ...baseEntry,
          incomeType: 'DIVIDENDS' as IncomeType,
          amount: Number(data.totalOrdinaryDividends) || 0,
          payerName: (data.payerName as string) || '',
          payerTIN: (data.payerTIN as string) || ''
        }
        
      default:
        return {
          ...baseEntry,
          amount: Object.values(data).find(v => typeof v === 'number' && v > 0) || 0
        }
    }
  })
}

function getIncomeTypeFromForm(formType: DocumentType): IncomeType {
  const mapping: Record<DocumentType, IncomeType> = {
    'W2': 'W2_WAGES',
    'W2_CORRECTED': 'W2_WAGES',
    'W3': 'W2_WAGES',
    'FORM_1099_NEC': 'NONEMPLOYEE_COMPENSATION',
    'FORM_1099_MISC': 'BUSINESS_INCOME',
    'FORM_1099_INT': 'INTEREST',
    'FORM_1099_DIV': 'DIVIDENDS',
    'FORM_1099_G': 'UNEMPLOYMENT',
    'FORM_1099_R': 'RETIREMENT_DISTRIBUTIONS',
    'FORM_1099_K': 'OTHER_INCOME',
    'FORM_1099_B': 'PROCEEDS_FROM_BROKER',
    'FORM_1099_S': 'PROCEEDS_FROM_REAL_ESTATE',
    'FORM_1099_A': 'ACQUISITION_ABANDONMENT_SECURED_PROPERTY',
    'FORM_1099_C': 'CANCELLATION_OF_DEBT',
    'FORM_1099_OID': 'ORIGINAL_ISSUE_DISCOUNT',
    'FORM_1099_PATR': 'TAXABLE_PATRONAGE_DIVIDENDS',
    'FORM_1099_Q': 'QUALIFIED_EDUCATION_EXPENSES',
    'FORM_1099_SA': 'ARCHER_MSA_DISTRIBUTIONS',
    'FORM_1098': 'OTHER_INCOME',
    'FORM_1098_E': 'OTHER_INCOME',
    'FORM_1098_T': 'OTHER_INCOME',
    'FORM_5498': 'OTHER_INCOME',
    'SCHEDULE_K1': 'BUSINESS_INCOME',
    'OTHER_TAX_DOCUMENT': 'OTHER_INCOME',
    'RECEIPT': 'OTHER_INCOME',
    'STATEMENT': 'OTHER_INCOME',
    'UNKNOWN': 'OTHER_INCOME'
  }
  
  return mapping[formType] || 'OTHER_INCOME'
}
