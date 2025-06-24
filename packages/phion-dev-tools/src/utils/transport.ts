import assert from "node:assert"
import type { AddressInfo } from "node:net"

export function httpAddressToString(address: string | AddressInfo | null): string {
  assert(address, "Could not bind server socket")
  if (typeof address === "string") return address
  const resolvedPort = address.port
  let resolvedHost = address.family === "IPv4" ? address.address : `[${address.address}]`
  if (resolvedHost === "0.0.0.0" || resolvedHost === "[::]") resolvedHost = "localhost"
  return `http://${resolvedHost}:${resolvedPort}`
}
