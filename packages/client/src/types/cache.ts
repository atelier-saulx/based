export type Cache = Map<
  number,
  {
    value: any
    checksum: number
  }
>
