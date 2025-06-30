type IoJobLoad = {
  type: 'load'
  filepath: string
}

type IoJobUnload = {
  type: 'unload'
  filepath: string
  typeId: number
  start: number
}

export type IoJob = IoJobLoad | IoJobUnload
