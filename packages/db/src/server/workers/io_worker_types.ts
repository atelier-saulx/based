export type IoJob = {
  type: 'load' | 'unload'
  filepath: string
  typeId?: number
  start?: number
}
