export type Cache = Map<
  number,
  {
    persistent?: boolean
    value: any
    checksum: number
  }
>
