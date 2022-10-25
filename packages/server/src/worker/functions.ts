const fnPathMap: Map<string, string> = new Map()

const fnInstallListeners: Map<string, ((fn: Function, err?: Error) => void)[]> =
  new Map()

export { fnPathMap, fnInstallListeners }
