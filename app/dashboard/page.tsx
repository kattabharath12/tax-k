export const dynamic = 'force-dynamic'
export const revalidate = 0

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"  // Add this import
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { DashboardClient } from "@/components/dashboard-client"

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)  // Add authOptions here
  
  if (!session?.user?.email) {
    redirect("/auth/login")
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      taxReturns: {
        orderBy: { createdAt: "desc" },
        take: 5
      }
    }
  })

  if (!user) {
    redirect("/auth/login")
  }

  return <DashboardClient user={user} />
}
