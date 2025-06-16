"use client"

import { useState, useEffect } from "react"
import { createAuthBrowserClient } from "@shipvibes/database"

export default function DebugWaitlistPage() {
  const [user, setUser] = useState<any>(null)
  const [waitlistData, setWaitlistData] = useState<any>(null)
  const [error, setError] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createAuthBrowserClient()

  useEffect(() => {
    checkData()
  }, [])

  const checkData = async () => {
    try {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)
      console.log("👤 Current user:", user)

      if (user?.email) {
        // Check table structure
        const { data: allEntries } = await supabase.from("waitlist").select("*").limit(5)

        console.log("📋 All waitlist entries:", allEntries)

        // Check specific user entry
        const { data: userEntry, error: userError } = await supabase
          .from("waitlist")
          .select("*")
          .eq("email", user.email)
          .maybeSingle()

        console.log("🔍 User entry:", { data: userEntry, error: userError })
        setWaitlistData(userEntry)
        setError(userError)
      }
    } catch (err) {
      console.error("❌ Error:", err)
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async (newStatus: string) => {
    if (!waitlistData) return

    try {
      const { data, error } = await supabase
        .from("waitlist")
        .update({ status: newStatus })
        .eq("id", waitlistData.id)
        .select()
        .single()

      if (error) {
        console.error("Update error:", error)
      } else {
        console.log("✅ Updated:", data)
        setWaitlistData(data)
      }
    } catch (err) {
      console.error("❌ Update failed:", err)
    }
  }

  if (loading) return <div className="p-8">Loading...</div>

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Debug Waitlist</h1>

      <div className="space-y-4">
        <div className="bg-gray-100 p-4 rounded">
          <h3 className="font-semibold">User Info:</h3>
          <pre className="text-sm overflow-auto">{JSON.stringify(user, null, 2)}</pre>
        </div>

        <div className="bg-gray-100 p-4 rounded">
          <h3 className="font-semibold">Waitlist Entry:</h3>
          <pre className="text-sm overflow-auto">{JSON.stringify(waitlistData, null, 2)}</pre>
        </div>

        {error && (
          <div className="bg-red-100 p-4 rounded">
            <h3 className="font-semibold text-red-800">Error:</h3>
            <pre className="text-sm overflow-auto text-red-700">
              {JSON.stringify(error, null, 2)}
            </pre>
          </div>
        )}

        {waitlistData && (
          <div className="space-x-2">
            <button
              onClick={() => updateStatus("pending")}
              className="bg-yellow-500 text-white px-4 py-2 rounded"
            >
              Set Pending
            </button>
            <button
              onClick={() => updateStatus("approved")}
              className="bg-green-500 text-white px-4 py-2 rounded"
            >
              Set Approved
            </button>
            <button
              onClick={() => updateStatus("rejected")}
              className="bg-red-500 text-white px-4 py-2 rounded"
            >
              Set Rejected
            </button>
          </div>
        )}

        <button onClick={checkData} className="bg-blue-500 text-white px-4 py-2 rounded">
          Refresh Data
        </button>
      </div>
    </div>
  )
}
