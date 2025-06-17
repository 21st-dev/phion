import { Database } from "./types"

// Legacy type exports for backward compatibility
export type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]
export type ProjectInsert = Database["public"]["Tables"]["projects"]["Insert"]
export type ProjectUpdate = Database["public"]["Tables"]["projects"]["Update"]

export type FileHistoryRow = Database["public"]["Tables"]["file_history"]["Row"]
export type FileHistoryInsert = Database["public"]["Tables"]["file_history"]["Insert"]
export type FileHistoryUpdate = Database["public"]["Tables"]["file_history"]["Update"]

export type CommitHistoryRow = Database["public"]["Tables"]["commit_history"]["Row"]
export type CommitHistoryInsert = Database["public"]["Tables"]["commit_history"]["Insert"]
export type CommitHistoryUpdate = Database["public"]["Tables"]["commit_history"]["Update"]

export type WaitlistRow = Database["public"]["Tables"]["waitlist"]["Row"]
export type WaitlistInsert = Database["public"]["Tables"]["waitlist"]["Insert"]
export type WaitlistUpdate = Database["public"]["Tables"]["waitlist"]["Update"]
