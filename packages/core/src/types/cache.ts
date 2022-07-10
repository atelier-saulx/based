export type Cache = {
  [queryId: string]: {
    value: any
    checksum: number
  }
}
