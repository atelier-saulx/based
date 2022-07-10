import { BasedFunctionSpec, BasedObservableFunctionSpec } from '../types'

export const fnIsTimedOut = (
  spec: BasedObservableFunctionSpec | BasedFunctionSpec
): boolean => {
  if (spec.timeoutCounter !== -1) {
    if (spec.idleTimeout > 0) {
      spec.idleTimeout--
    }
    if (spec.idleTimeout === 0) {
      return true
    }
  }
  return false
}

export const updateTimeoutCounter = (
  spec: BasedObservableFunctionSpec | BasedFunctionSpec,
  idleTimeoutDefault: number
) => {
  if (spec.timeoutCounter !== -1) {
    const idleTimeout = spec.idleTimeout || idleTimeoutDefault
    spec.timeoutCounter = idleTimeout === 0 ? -1 : idleTimeout
  }
}
