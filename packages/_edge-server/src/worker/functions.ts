import { FunctionType, ImportWrapper } from '../types'
import { workerData } from 'worker_threads'
import send from './send'
import { OutgoingType } from './types'

const importWrapper: ImportWrapper =
  require(workerData.importWrapperPath).default ||
  require(workerData.importWrapperPath)

const fnPathMap: Map<string, string> = new Map()

const fnInstallListeners: Map<string, ((err?: Error) => void)[]> = new Map()

const initializedFnMap: Map<string, Function> = new Map()

const addFunction = (name: string, path: string) => {
  const prevPath = fnPathMap.get(name)
  if (prevPath && prevPath !== path) {
    removeFunctionPath(prevPath)
  }
  fnPathMap.set(name, path)
  const listeners = fnInstallListeners.get(name)
  if (listeners) {
    listeners.forEach((r) => r())
    fnInstallListeners.delete(name)
  }
}

const errorInstallFunction = (name: string) => {
  removeFunction(name)
  const listeners = fnInstallListeners.get(name)
  if (listeners) {
    const err = new Error(`Cannot install function ${name}`)
    listeners.forEach((r) => r(err))
    fnInstallListeners.delete(name)
  }
}

const removeFunctionPath = (path: string) => {
  initializedFnMap.delete(path)
  delete require.cache[require.resolve(path)]
}

const removeFunction = (name: string) => {
  const path = fnPathMap.get(name)
  if (path) {
    removeFunctionPath(path)
    fnPathMap.delete(name)
  }
}

const getFunctionByName = (
  name: string,
  type: FunctionType
): false | Function => {
  const path = fnPathMap.get(name)
  if (path) {
    return getFunction(name, type, path)
  } else {
    return false
  }
}

const getFunction = (
  name: string,
  type: FunctionType,
  path: string
): Function => {
  if (initializedFnMap.has(path)) {
    return initializedFnMap.get(path)
  }
  const fn = importWrapper(name, type, path)
  initializedFnMap.set(path, fn)
  fnPathMap.set(name, path)
  return fn
}

const installFunction = (
  name: string,
  type: FunctionType
): Promise<Function> => {
  return new Promise((resolve, reject) => {
    const prevPath = fnPathMap.get(name)
    if (prevPath) {
      resolve(getFunction(name, type, prevPath))
    } else {
      let listeners = fnInstallListeners.get(name)
      if (!listeners) {
        listeners = []
        fnInstallListeners.set(name, listeners)
      }
      listeners.push((err) => {
        if (err) {
          reject(err)
        } else {
          const fn = getFunctionByName(name, type)
          if (!fn) {
            reject(new Error('Function not well installed ' + name))
          } else {
            resolve(fn)
          }
        }
      })
      send({
        type: OutgoingType.InstallFn,
        name,
      })
    }
  })
}

export {
  addFunction,
  getFunction,
  removeFunction,
  installFunction,
  getFunctionByName,
  errorInstallFunction,
}