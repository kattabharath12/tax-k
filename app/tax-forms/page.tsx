
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { TaxFormsManagement } from '@/components/tax-forms-management'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileText, Plus, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface PageProps {
  searchParams: {
    taxReturnId?: string
  }
}

export default async function TaxFormsPage({ searchParams }: PageProps) {
  const session = await getServerSession()
  
  if (!session?.user?.email) {
    redirect('/auth/login')
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      taxReturns: {
        orderBy: { createdAt: 'desc' }
      }
    }
  })

  if (!user) {
    redirect('/auth/login')
  }

  // Get the specified tax return or the most recent one
  let selectedTaxReturn = null
  if (searchParams.taxReturnId) {
    selectedTaxReturn = await prisma.taxReturn.findFirst({
      where: {
        id: searchParams.taxReturnId,
        userId: user.id
      },
      include: {
        incomeEntries: {
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        dataUploads: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    })
  } else if (user.taxReturns.length > 0) {
    selectedTaxReturn = await prisma.taxReturn.findFirst({
      where: {
        id: user.taxReturns[0].id
      },
      include: {
        incomeEntries: {
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        dataUploads: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <div className="flex items-center space-x-2">
                <FileText className="h-8 w-8 text-primary" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Tax Forms Management</h1>
                  <p className="text-sm text-gray-600">Upload and process tax form data</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="outline">
                {user.name || user.email}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!selectedTaxReturn ? (
          /* No Tax Return Selected */
          <div className="text-center space-y-6">
            <Card className="max-w-md mx-auto">
              <CardHeader>
                <CardTitle className="flex items-center justify-center gap-2">
                  <FileText className="h-6 w-6" />
                  No Tax Return Selected
                </CardTitle>
                <CardDescription>
                  You need to create a tax return before importing tax form data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {user.taxReturns.length === 0 ? (
                  <div>
                    <p className="text-sm text-muted-foreground mb-4">
                      Create your first tax return to get started with importing tax forms.
                    </p>
                    <Link href="/dashboard">
                      <Button className="w-full">
                        <Plus className="h-4 w-4 mr-2" />
                        Create Tax Return
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-muted-foreground mb-4">
                      Select a tax return to import tax form data:
                    </p>
                    <div className="space-y-2">
                      {user.taxReturns.map((taxReturn) => (
                        <Link 
                          key={taxReturn.id} 
                          href={`/tax-forms?taxReturnId=${taxReturn.id}`}
                        >
                          <Button variant="outline" className="w-full justify-start">
                            <FileText className="h-4 w-4 mr-2" />
                            {taxReturn.taxYear} Tax Return
                            <Badge variant="secondary" className="ml-auto">
                              {taxReturn.filingStatus.replace('_', ' ')}
                            </Badge>
                          </Button>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          /* Tax Forms Management Interface */
          <div className="space-y-6">
            {/* Tax Return Info */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      {selectedTaxReturn.taxYear} Tax Return
                    </CardTitle>
                    <CardDescription>
                      Filing Status: {selectedTaxReturn.filingStatus.replace('_', ' ')} • 
                      {selectedTaxReturn.incomeEntries?.length || 0} income entries • 
                      {selectedTaxReturn.dataUploads?.length || 0} uploaded files
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      Step {selectedTaxReturn.currentStep}
                    </Badge>
                    <Badge variant={selectedTaxReturn.isCompleted ? 'default' : 'secondary'}>
                      {selectedTaxReturn.isCompleted ? 'Complete' : 'In Progress'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      ${Number(selectedTaxReturn.totalIncome).toLocaleString()}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Total Income
                    </div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      ${Number(selectedTaxReturn.adjustedGrossIncome).toLocaleString()}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Adjusted Gross Income
                    </div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      ${Math.max(Number(selectedTaxReturn.refundAmount) - Number(selectedTaxReturn.amountOwed), 0).toLocaleString()}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Estimated Refund
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tax Forms Management Component */}
            <TaxFormsManagement 
              taxReturnId={selectedTaxReturn.id}
              onFormsImported={(count) => {
                // Could trigger a refresh or show additional confirmation
                console.log(`Imported ${count} forms`)
              }}
            />
          </div>
        )}
      </main>
    </div>
  )
}
