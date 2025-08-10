
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'

interface Props {
  params: {
    id: string
  }
}

export async function GET(req: NextRequest, { params }: Props) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify the tax return belongs to the user
    const taxReturn = await prisma.taxReturn.findFirst({
      where: {
        id: params.id,
        userId: user.id
      }
    })

    if (!taxReturn) {
      return NextResponse.json({ error: 'Tax return not found' }, { status: 404 })
    }

    // Fetch income entries for this tax return
    const entries = await prisma.incomeEntry.findMany({
      where: {
        taxReturnId: params.id
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({ entries })

  } catch (error) {
    console.error('Get income entries error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest, { params }: Props) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify the tax return belongs to the user
    const taxReturn = await prisma.taxReturn.findFirst({
      where: {
        id: params.id,
        userId: user.id
      }
    })

    if (!taxReturn) {
      return NextResponse.json({ error: 'Tax return not found' }, { status: 404 })
    }

    const body = await req.json()
    const {
      incomeType,
      description,
      amount,
      employerName,
      employerEIN,
      payerName,
      payerTIN
    } = body

    // Create new income entry
    const incomeEntry = await prisma.incomeEntry.create({
      data: {
        taxReturnId: params.id,
        incomeType,
        description,
        amount,
        employerName,
        employerEIN,
        payerName,
        payerTIN
      }
    })

    return NextResponse.json({ incomeEntry })

  } catch (error) {
    console.error('Create income entry error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}
