declare module "diff" {
  export interface Change {
    added?: boolean
    removed?: boolean
    value: string
  }

  export function diffLines(oldStr: string, newStr: string): Change[]
}
