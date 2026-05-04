/**
 * Metronome usage-based billing API client.
 * https://docs.metronome.com
 *
 * All functions are no-ops when METRONOME_API_KEY is not set, so the
 * integration is safe to deploy before the key is provisioned.
 */

const METRONOME_BASE = "https://api.metronome.com/v1"

function getApiKey(): string | undefined {
  return process.env.METRONOME_API_KEY
}

/**
 * Idempotently ensure a Metronome customer exists for the given Supabase user.
 * Uses the Supabase user ID as an `ingest_alias` so events can be attributed
 * without separately storing the Metronome customer UUID.
 *
 * A 409 response is treated as success (customer already exists).
 */
export async function ensureMetronomeCustomer(userId: string, email: string): Promise<void> {
  const apiKey = getApiKey()
  if (!apiKey) return

  try {
    const res = await fetch(`${METRONOME_BASE}/customers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: email,
        ingest_aliases: [userId],
      }),
    })

    if (!res.ok && res.status !== 409) {
      console.error(`Metronome: ensureCustomer failed [${res.status}]`, await res.text())
    }
  } catch (err) {
    console.error("Metronome: ensureCustomer error", err)
  }
}

/**
 * Ingest a usage event for the given user (identified by Supabase user ID,
 * which must have been registered as an ingest_alias via ensureMetronomeCustomer).
 *
 * Failures are logged but never thrown — billing should never block the
 * primary request path.
 */
export async function ingestUsageEvent(
  userId: string,
  eventType: string,
  properties: Record<string, string | number | boolean> = {},
): Promise<void> {
  const apiKey = getApiKey()
  if (!apiKey) return

  try {
    const res = await fetch(`${METRONOME_BASE}/ingest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        events: [
          {
            transaction_id: `${userId}-${eventType}-${Date.now()}`,
            customer_id: userId,
            event_type: eventType,
            timestamp: new Date().toISOString(),
            properties,
          },
        ],
      }),
    })

    if (!res.ok) {
      console.error(`Metronome: ingest failed [${res.status}] for ${eventType}`, await res.text())
    }
  } catch (err) {
    console.error(`Metronome: ingest error for ${eventType}`, err)
  }
}
