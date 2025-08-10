
export interface FormField {
  name: string
  label: string
  type: 'text' | 'number' | 'decimal' | 'date' | 'boolean' | 'select'
  required: boolean
  boxNumber?: string // IRS form box number
  description?: string
  options?: string[] // for select fields
  validation?: {
    min?: number
    max?: number
    pattern?: string
  }
}

// W-2 Form Structure
export const W2_TEMPLATE: FormField[] = [
  { name: 'employerEIN', label: 'Employer\'s EIN', type: 'text', required: true, boxNumber: 'a' },
  { name: 'employerName', label: 'Employer\'s Name', type: 'text', required: true, boxNumber: 'b' },
  { name: 'employerAddress', label: 'Employer\'s Address', type: 'text', required: true, boxNumber: 'c' },
  { name: 'employeeSSN', label: 'Employee\'s SSN', type: 'text', required: true, boxNumber: 'd' },
  { name: 'employeeName', label: 'Employee\'s Name', type: 'text', required: true, boxNumber: 'e' },
  { name: 'employeeAddress', label: 'Employee\'s Address', type: 'text', required: true, boxNumber: 'f' },
  { name: 'wages', label: 'Wages, tips, other compensation', type: 'decimal', required: true, boxNumber: '1' },
  { name: 'federalIncomeTaxWithheld', label: 'Federal income tax withheld', type: 'decimal', required: false, boxNumber: '2' },
  { name: 'socialSecurityWages', label: 'Social security wages', type: 'decimal', required: false, boxNumber: '3' },
  { name: 'socialSecurityTaxWithheld', label: 'Social security tax withheld', type: 'decimal', required: false, boxNumber: '4' },
  { name: 'medicareWages', label: 'Medicare wages and tips', type: 'decimal', required: false, boxNumber: '5' },
  { name: 'medicareTaxWithheld', label: 'Medicare tax withheld', type: 'decimal', required: false, boxNumber: '6' },
  { name: 'socialSecurityTips', label: 'Social security tips', type: 'decimal', required: false, boxNumber: '7' },
  { name: 'allocatedTips', label: 'Allocated tips', type: 'decimal', required: false, boxNumber: '8' },
  { name: 'dependentCareBenefits', label: 'Dependent care benefits', type: 'decimal', required: false, boxNumber: '10' },
  { name: 'nonqualifiedPlans', label: 'Nonqualified plans', type: 'decimal', required: false, boxNumber: '11' },
  { name: 'statutoryEmployee', label: 'Statutory employee', type: 'boolean', required: false, boxNumber: '13' },
  { name: 'retirementPlan', label: 'Retirement plan', type: 'boolean', required: false, boxNumber: '13' },
  { name: 'thirdPartySickPay', label: 'Third-party sick pay', type: 'boolean', required: false, boxNumber: '13' },
  { name: 'stateWages', label: 'State wages, tips, etc.', type: 'decimal', required: false, boxNumber: '16' },
  { name: 'stateIncomeTax', label: 'State income tax', type: 'decimal', required: false, boxNumber: '17' },
  { name: 'localWages', label: 'Local wages, tips, etc.', type: 'decimal', required: false, boxNumber: '18' },
  { name: 'localIncomeTax', label: 'Local income tax', type: 'decimal', required: false, boxNumber: '19' }
]

// 1099-NEC Form Structure
export const FORM_1099_NEC_TEMPLATE: FormField[] = [
  { name: 'payerTIN', label: 'Payer\'s TIN', type: 'text', required: true, boxNumber: 'TIN' },
  { name: 'payerName', label: 'Payer\'s Name', type: 'text', required: true },
  { name: 'payerAddress', label: 'Payer\'s Address', type: 'text', required: true },
  { name: 'recipientTIN', label: 'Recipient\'s TIN', type: 'text', required: true },
  { name: 'recipientName', label: 'Recipient\'s Name', type: 'text', required: true },
  { name: 'recipientAddress', label: 'Recipient\'s Address', type: 'text', required: true },
  { name: 'nonemployeeCompensation', label: 'Nonemployee compensation', type: 'decimal', required: true, boxNumber: '1' },
  { name: 'federalIncomeTaxWithheld', label: 'Federal income tax withheld', type: 'decimal', required: false, boxNumber: '4' },
  { name: 'stateNumber', label: 'State number', type: 'text', required: false, boxNumber: '5' },
  { name: 'stateIncomeTax', label: 'State income tax withheld', type: 'decimal', required: false, boxNumber: '6' }
]

// 1099-MISC Form Structure  
export const FORM_1099_MISC_TEMPLATE: FormField[] = [
  { name: 'payerTIN', label: 'Payer\'s TIN', type: 'text', required: true },
  { name: 'payerName', label: 'Payer\'s Name', type: 'text', required: true },
  { name: 'payerAddress', label: 'Payer\'s Address', type: 'text', required: true },
  { name: 'recipientTIN', label: 'Recipient\'s TIN', type: 'text', required: true },
  { name: 'recipientName', label: 'Recipient\'s Name', type: 'text', required: true },
  { name: 'recipientAddress', label: 'Recipient\'s Address', type: 'text', required: true },
  { name: 'rents', label: 'Rents', type: 'decimal', required: false, boxNumber: '1' },
  { name: 'royalties', label: 'Royalties', type: 'decimal', required: false, boxNumber: '2' },
  { name: 'otherIncome', label: 'Other income', type: 'decimal', required: false, boxNumber: '3' },
  { name: 'federalIncomeTaxWithheld', label: 'Federal income tax withheld', type: 'decimal', required: false, boxNumber: '4' },
  { name: 'fishingBoatProceeds', label: 'Fishing boat proceeds', type: 'decimal', required: false, boxNumber: '5' },
  { name: 'medicalHealthcarePayments', label: 'Medical and health care payments', type: 'decimal', required: false, boxNumber: '6' },
  { name: 'substitutePayments', label: 'Substitute payments in lieu of dividends or interest', type: 'decimal', required: false, boxNumber: '8' },
  { name: 'cropInsuranceProceeds', label: 'Crop insurance proceeds', type: 'decimal', required: false, boxNumber: '9' },
  { name: 'grossProceeds', label: 'Gross proceeds paid to an attorney', type: 'decimal', required: false, boxNumber: '10' },
  { name: 'section409ADeferrals', label: 'Section 409A deferrals', type: 'decimal', required: false, boxNumber: '12' },
  { name: 'excessGoldenParachute', label: 'Excess golden parachute payments', type: 'decimal', required: false, boxNumber: '13' },
  { name: 'nonqualifiedDeferredCompensation', label: 'Nonqualified deferred compensation', type: 'decimal', required: false, boxNumber: '14' }
]

// 1099-INT Form Structure
export const FORM_1099_INT_TEMPLATE: FormField[] = [
  { name: 'payerTIN', label: 'Payer\'s TIN', type: 'text', required: true },
  { name: 'payerName', label: 'Payer\'s Name', type: 'text', required: true },
  { name: 'payerAddress', label: 'Payer\'s Address', type: 'text', required: true },
  { name: 'recipientTIN', label: 'Recipient\'s TIN', type: 'text', required: true },
  { name: 'recipientName', label: 'Recipient\'s Name', type: 'text', required: true },
  { name: 'recipientAddress', label: 'Recipient\'s Address', type: 'text', required: true },
  { name: 'interestIncome', label: 'Interest income', type: 'decimal', required: true, boxNumber: '1' },
  { name: 'earlyWithdrawalPenalty', label: 'Early withdrawal penalty', type: 'decimal', required: false, boxNumber: '2' },
  { name: 'interestOnUsSavingsBonds', label: 'Interest on U.S. Savings Bonds and Treasury obligations', type: 'decimal', required: false, boxNumber: '3' },
  { name: 'federalIncomeTaxWithheld', label: 'Federal income tax withheld', type: 'decimal', required: false, boxNumber: '4' },
  { name: 'investmentExpenses', label: 'Investment expenses', type: 'decimal', required: false, boxNumber: '5' },
  { name: 'foreignTaxPaid', label: 'Foreign tax paid', type: 'decimal', required: false, boxNumber: '6' },
  { name: 'foreignCountry', label: 'Foreign country or U.S. possession', type: 'text', required: false, boxNumber: '7' },
  { name: 'taxExemptInterest', label: 'Tax-exempt interest', type: 'decimal', required: false, boxNumber: '8' },
  { name: 'specifiedPrivateActivityBondInterest', label: 'Specified private activity bond interest', type: 'decimal', required: false, boxNumber: '9' }
]

// 1099-DIV Form Structure
export const FORM_1099_DIV_TEMPLATE: FormField[] = [
  { name: 'payerTIN', label: 'Payer\'s TIN', type: 'text', required: true },
  { name: 'payerName', label: 'Payer\'s Name', type: 'text', required: true },
  { name: 'payerAddress', label: 'Payer\'s Address', type: 'text', required: true },
  { name: 'recipientTIN', label: 'Recipient\'s TIN', type: 'text', required: true },
  { name: 'recipientName', label: 'Recipient\'s Name', type: 'text', required: true },
  { name: 'recipientAddress', label: 'Recipient\'s Address', type: 'text', required: true },
  { name: 'totalOrdinaryDividends', label: 'Total ordinary dividends', type: 'decimal', required: true, boxNumber: '1a' },
  { name: 'qualifiedDividends', label: 'Qualified dividends', type: 'decimal', required: false, boxNumber: '1b' },
  { name: 'totalCapitalGainDistributions', label: 'Total capital gain distributions', type: 'decimal', required: false, boxNumber: '2a' },
  { name: 'unrecapturedSection1250Gain', label: 'Unrecap. Sec. 1250 gain', type: 'decimal', required: false, boxNumber: '2b' },
  { name: 'section1202Gain', label: 'Section 1202 gain', type: 'decimal', required: false, boxNumber: '2c' },
  { name: 'collectiblesGain', label: 'Collectibles (28%) gain', type: 'decimal', required: false, boxNumber: '2d' },
  { name: 'nondividendDistributions', label: 'Nondividend distributions', type: 'decimal', required: false, boxNumber: '3' },
  { name: 'federalIncomeTaxWithheld', label: 'Federal income tax withheld', type: 'decimal', required: false, boxNumber: '4' },
  { name: 'investmentExpenses', label: 'Investment expenses', type: 'decimal', required: false, boxNumber: '5' },
  { name: 'foreignTaxPaid', label: 'Foreign tax paid', type: 'decimal', required: false, boxNumber: '6' },
  { name: 'foreignCountry', label: 'Foreign country or U.S. possession', type: 'text', required: false, boxNumber: '7' },
  { name: 'cashLiquidationDistributions', label: 'Cash liquidation distributions', type: 'decimal', required: false, boxNumber: '8' },
  { name: 'noncashLiquidationDistributions', label: 'Noncash liquidation distributions', type: 'decimal', required: false, boxNumber: '9' }
]

// 1099-G Form Structure
export const FORM_1099_G_TEMPLATE: FormField[] = [
  { name: 'payerTIN', label: 'Payer\'s TIN', type: 'text', required: true },
  { name: 'payerName', label: 'Payer\'s Name', type: 'text', required: true },
  { name: 'payerAddress', label: 'Payer\'s Address', type: 'text', required: true },
  { name: 'recipientTIN', label: 'Recipient\'s TIN', type: 'text', required: true },
  { name: 'recipientName', label: 'Recipient\'s Name', type: 'text', required: true },
  { name: 'recipientAddress', label: 'Recipient\'s Address', type: 'text', required: true },
  { name: 'unemploymentCompensation', label: 'Unemployment compensation', type: 'decimal', required: false, boxNumber: '1' },
  { name: 'stateLocalIncomeTaxRefunds', label: 'State or local income tax refunds', type: 'decimal', required: false, boxNumber: '2' },
  { name: 'federalIncomeTaxWithheld', label: 'Federal income tax withheld', type: 'decimal', required: false, boxNumber: '4' },
  { name: 'rtaaPayments', label: 'RTAA payments', type: 'decimal', required: false, boxNumber: '5' },
  { name: 'taxableGrants', label: 'Taxable grants', type: 'decimal', required: false, boxNumber: '6' },
  { name: 'agriculturePayments', label: 'Agriculture payments', type: 'decimal', required: false, boxNumber: '7' },
  { name: 'marketGainOnPublicAssistance', label: 'If checked, box 2 is trade or business income', type: 'boolean', required: false, boxNumber: '8' }
]

// 1099-R Form Structure
export const FORM_1099_R_TEMPLATE: FormField[] = [
  { name: 'payerTIN', label: 'Payer\'s TIN', type: 'text', required: true },
  { name: 'payerName', label: 'Payer\'s Name', type: 'text', required: true },
  { name: 'payerAddress', label: 'Payer\'s Address', type: 'text', required: true },
  { name: 'recipientTIN', label: 'Recipient\'s TIN', type: 'text', required: true },
  { name: 'recipientName', label: 'Recipient\'s Name', type: 'text', required: true },
  { name: 'recipientAddress', label: 'Recipient\'s Address', type: 'text', required: true },
  { name: 'grossDistribution', label: 'Gross distribution', type: 'decimal', required: true, boxNumber: '1' },
  { name: 'taxableAmount', label: 'Taxable amount', type: 'decimal', required: false, boxNumber: '2a' },
  { name: 'taxableAmountNotDetermined', label: 'Taxable amount not determined', type: 'boolean', required: false, boxNumber: '2b' },
  { name: 'totalDistribution', label: 'Total distribution', type: 'boolean', required: false, boxNumber: '2b' },
  { name: 'capitalGain', label: 'Capital gain', type: 'decimal', required: false, boxNumber: '3' },
  { name: 'federalIncomeTaxWithheld', label: 'Federal income tax withheld', type: 'decimal', required: false, boxNumber: '4' },
  { name: 'employeeContributions', label: 'Employee contributions/designated Roth contributions or insurance premiums', type: 'decimal', required: false, boxNumber: '5' },
  { name: 'netUnrealizedAppreciation', label: 'Net unrealized appreciation in employer\'s securities', type: 'decimal', required: false, boxNumber: '6' },
  { name: 'distributionCode', label: 'Distribution code(s)', type: 'text', required: false, boxNumber: '7' },
  { name: 'otherPercent', label: 'Other %', type: 'decimal', required: false, boxNumber: '8' },
  { name: 'yourPercentOfTotal', label: 'Your % of total distribution', type: 'decimal', required: false, boxNumber: '9a' },
  { name: 'amountAllocableToIRR', label: 'Amount allocable to IRR within 5 years', type: 'decimal', required: false, boxNumber: '9b' }
]

// All form templates mapping
export const FORM_TEMPLATES = {
  W2: W2_TEMPLATE,
  FORM_1099_NEC: FORM_1099_NEC_TEMPLATE,
  FORM_1099_MISC: FORM_1099_MISC_TEMPLATE,
  FORM_1099_INT: FORM_1099_INT_TEMPLATE,
  FORM_1099_DIV: FORM_1099_DIV_TEMPLATE,
  FORM_1099_G: FORM_1099_G_TEMPLATE,
  FORM_1099_R: FORM_1099_R_TEMPLATE,
  // Add more form templates as needed
}

export const FORM_DESCRIPTIONS = {
  W2: 'Wage and Tax Statement',
  FORM_1099_NEC: 'Nonemployee Compensation',
  FORM_1099_MISC: 'Miscellaneous Information',
  FORM_1099_INT: 'Interest Income',
  FORM_1099_DIV: 'Dividends and Distributions',
  FORM_1099_G: 'Certain Government Payments',
  FORM_1099_R: 'Distributions From Pensions, Annuities, Retirement or Profit-Sharing Plans',
  FORM_1099_B: 'Proceeds From Broker and Barter Exchange Transactions',
  FORM_1099_S: 'Proceeds From Real Estate Transactions',
  FORM_1099_A: 'Acquisition or Abandonment of Secured Property',
  FORM_1099_C: 'Cancellation of Debt',
  FORM_1099_OID: 'Original Issue Discount',
  FORM_1099_PATR: 'Taxable Distributions Received From Cooperatives',
  FORM_1099_Q: 'Payments From Qualified Education Programs',
  FORM_1099_SA: 'Distributions From an HSA, Archer MSA, or Medicare Advantage MSA',
  FORM_1099_K: 'Payment Card and Third Party Network Transactions'
}
