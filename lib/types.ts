import { Decimal } from "@prisma/client/runtime/library"

// ========== Basic Data Types ==========
export type DateRange = {
  from: Date | undefined
  to: Date | undefined
}

// ========== Prisma Enum Types ==========
export type FilingStatus = 
  | 'SINGLE'
  | 'MARRIED_FILING_JOINTLY'
  | 'MARRIED_FILING_SEPARATELY'
  | 'HEAD_OF_HOUSEHOLD'
  | 'QUALIFYING_SURVIVING_SPOUSE'

export type IncomeType = 
  | 'W2_WAGES'
  | 'INTEREST'
  | 'DIVIDENDS'
  | 'BUSINESS_INCOME'
  | 'CAPITAL_GAINS'
  | 'OTHER_INCOME'
  | 'UNEMPLOYMENT'
  | 'RETIREMENT_DISTRIBUTIONS'
  | 'SOCIAL_SECURITY'
  | 'NONEMPLOYEE_COMPENSATION'
  | 'RENTS'
  | 'ROYALTIES'
  | 'FISHING_BOAT_PROCEEDS'
  | 'MEDICAL_PAYMENTS'
  | 'SUBSTITUTE_PAYMENTS'
  | 'CROP_INSURANCE_PROCEEDS'
  | 'EXCESS_GOLDEN_PARACHUTE'
  | 'NONQUALIFIED_DEFERRED_COMPENSATION'
  | 'STATE_TAX_REFUNDS'
  | 'GAMBLING_WINNINGS'
  | 'PROCEEDS_FROM_BROKER'
  | 'PROCEEDS_FROM_REAL_ESTATE'
  | 'ACQUISITION_ABANDONMENT_SECURED_PROPERTY'
  | 'CANCELLATION_OF_DEBT'
  | 'ORIGINAL_ISSUE_DISCOUNT'
  | 'TAXABLE_PATRONAGE_DIVIDENDS'
  | 'QUALIFIED_EDUCATION_EXPENSES'
  | 'ARCHER_MSA_DISTRIBUTIONS'

export type DeductionType = 
  | 'MORTGAGE_INTEREST'
  | 'STATE_LOCAL_TAXES'
  | 'CHARITABLE_CONTRIBUTIONS'
  | 'MEDICAL_EXPENSES'
  | 'BUSINESS_EXPENSES'
  | 'STUDENT_LOAN_INTEREST'
  | 'IRA_CONTRIBUTIONS'
  | 'OTHER_DEDUCTIONS'

export type DocumentType = 
  | 'W2'
  | 'W2_CORRECTED'
  | 'W3'
  | 'FORM_1099_INT'
  | 'FORM_1099_DIV'
  | 'FORM_1099_MISC'
  | 'FORM_1099_NEC'
  | 'FORM_1099_R'
  | 'FORM_1099_G'
  | 'FORM_1099_K'
  | 'FORM_1099_B'
  | 'FORM_1099_S'
  | 'FORM_1099_A'
  | 'FORM_1099_C'
  | 'FORM_1099_OID'
  | 'FORM_1099_PATR'
  | 'FORM_1099_Q'
  | 'FORM_1099_SA'
  | 'FORM_1098'
  | 'FORM_1098_E'
  | 'FORM_1098_T'
  | 'FORM_5498'
  | 'SCHEDULE_K1'
  | 'OTHER_TAX_DOCUMENT'
  | 'RECEIPT'
  | 'STATEMENT'
  | 'UNKNOWN'

export type ProcessingStatus = 
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'MANUAL_REVIEW_REQUIRED'

export type EntryType = 
  | 'INCOME'
  | 'DEDUCTION'
  | 'CREDIT'
  | 'WITHHOLDING'

export type UploadStatus = 
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'

export type MappingStatus = 
  | 'DRAFT'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'FAILED'

export type ProcessStatus = 
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'REQUIRES_REVIEW'

// ========== Database Model Types ==========
export type TaxReturn = {
  id: string
  userId: string
  taxYear: number
  filingStatus: FilingStatus
  firstName?: string | null
  lastName?: string | null
  ssn?: string | null
  spouseFirstName?: string | null
  spouseLastName?: string | null
  spouseSsn?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  zipCode?: string | null
  totalIncome: Decimal
  adjustedGrossIncome: Decimal
  standardDeduction: Decimal
  itemizedDeduction: Decimal
  taxableIncome: Decimal
  taxLiability: Decimal
  totalCredits: Decimal
  refundAmount: Decimal
  amountOwed: Decimal
  currentStep: number
  completedSteps: number[]
  lastSavedAt?: Date | null
  isCompleted: boolean
  isFiled: boolean
  createdAt: Date
  updatedAt: Date
}

export type Document = {
  id: string
  taxReturnId: string
  fileName: string
  fileType: string
  fileSize: number
  filePath: string
  documentType: DocumentType
  processingStatus: ProcessingStatus
  ocrText?: string | null
  extractedData?: any
  isVerified: boolean
  verifiedBy?: string | null
  verificationNotes?: string | null
  createdAt: Date
  updatedAt: Date
}

export type IncomeEntry = {
  id: string
  taxReturnId: string
  incomeType: IncomeType
  description?: string | null
  amount: Decimal
  employerName?: string | null
  employerEIN?: string | null
  payerName?: string | null
  payerTIN?: string | null
  createdAt: Date
  updatedAt: Date
}

export type DeductionEntry = {
  id: string
  taxReturnId: string
  deductionType: DeductionType
  description?: string | null
  amount: Decimal
  createdAt: Date
  updatedAt: Date
}

export type DataUpload = {
  id: string
  userId: string
  taxReturnId?: string | null
  fileName: string
  fileType: string
  fileSize: number
  filePath: string
  status: UploadStatus
  totalRows: number
  processedRows: number
  errorRows: number
  previewData?: any
  errorLog?: any
  createdAt: Date
  updatedAt: Date
}

export type FormTemplate = {
  id: string
  formType: DocumentType
  templateName: string
  templateVersion: string
  isDefault: boolean
  formFields: any
  requiredFields: string[]
  calculatedFields?: any
  validationRules?: any
  createdAt: Date
  updatedAt: Date
}

export type DataMapping = {
  id: string
  userId: string
  uploadId?: string | null
  templateId: string
  mappingName: string
  isTemplate: boolean
  fieldMappings: any
  transformations?: any
  defaultValues?: any
  status: MappingStatus
  createdAt: Date
  updatedAt: Date
}

export type ProcessedFormData = {
  id: string
  taxReturnId: string
  uploadId?: string | null
  mappingId?: string | null
  formType: DocumentType
  formData: any
  originalRow?: any
  rowNumber?: number | null
  status: ProcessStatus
  validationErrors?: any
  incomeEntryId?: string | null
  deductionEntryId?: string | null
  createdAt: Date
  updatedAt: Date
}

// ========== API Response Types ==========
export type ApiResponse<T = any> = {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export type DocumentProcessingResponse = {
  id: string
  fileName: string
  documentType: DocumentType
  status: ProcessingStatus
  processingStatus: ProcessingStatus
  ocrText?: string
  extractedData?: any
  createdAt: Date
  updatedAt: Date
}

export type DataUploadResponse = ApiResponse<{
  upload: DataUpload
  previewData?: any[]
}>

export type DataMappingResponse = ApiResponse<{
  mapping: DataMapping
  template: FormTemplate
}>

// ========== Form Data Types ==========
export type W2FormData = {
  employerName: string
  employerEIN: string
  employeeSSN: string
  employeeName: string
  wages: number
  federalIncomeTaxWithheld: number
  socialSecurityWages: number
  socialSecurityTaxWithheld: number
  medicareWages: number
  medicareTaxWithheld: number
  socialSecurityTips?: number
  allocatedTips?: number
  dependentCareBenefits?: number
  nonqualifiedPlans?: number
  codes?: string[]
  stateTaxInfo?: Array<{
    state: string
    wages: number
    taxWithheld: number
  }>
  localTaxInfo?: Array<{
    locality: string
    wages: number
    taxWithheld: number
  }>
}

export type Form1099Data = {
  payerName: string
  payerTIN: string
  recipientSSN: string
  recipientName: string
  accountNumber?: string
  formType: '1099-INT' | '1099-DIV' | '1099-MISC' | '1099-NEC' | '1099-R' | '1099-G' | '1099-K' | '1099-B' | '1099-S' | '1099-A' | '1099-C' | '1099-OID' | '1099-PATR' | '1099-Q' | '1099-SA'
  // Common 1099 fields - specific forms will have more specific fields
  income: number
  federalIncomeTaxWithheld?: number
  stateTaxWithheld?: number
  statePayerNumber?: string
}

// ========== Utility Types ==========
export type CsvRowData = Record<string, string | number | null>

export type ExcelRowData = Record<string, any>

export type FileProcessingResult = {
  success: boolean
  data?: CsvRowData[] | ExcelRowData[]
  headers?: string[]
  totalRows?: number
  error?: string
}

export type ValidationError = {
  field: string
  message: string
  value?: any
}

export type FormValidationResult = {
  isValid: boolean
  errors: ValidationError[]
  warnings?: string[]
}

// ========== Error Types ==========
export type AppError = {
  code: string
  message: string
  details?: any
  stack?: string
}

export type DatabaseError = AppError & {
  operation: 'create' | 'read' | 'update' | 'delete'
  table: string
}

export type ProcessingError = AppError & {
  stage: 'upload' | 'parsing' | 'mapping' | 'validation' | 'storage'
  fileName?: string
}

// ========== Legacy Types (for backward compatibility) ==========
export type Expense = {
  id: string
  amount: number
  category: string
  description: string
  date: Date
}

export type ExpenseFormData = Omit<Expense, 'id' | 'date'> & {
  date: string
}

export const EXPENSE_CATEGORIES = [
  'Food',
  'Transportation',
  'Housing',
  'Utilities',
  'Entertainment',
  'Healthcare',
  'Shopping',
  'Education',
  'Other'
] as const