export type IoJobSave = {
  type: 'save'
  blocks: {
    filepath: string
    typeId: number
    start: number
  }[]
}

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

export type IoJob = IoJobSave | IoJobLoad | IoJobUnload
