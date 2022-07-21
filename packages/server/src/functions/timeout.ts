import type { BasedFunctionSpec, BasedObservableFunctionSpec } from '../types'

export const fnIsTimedOut = (
  spec: BasedObservableFunctionSpec | BasedFunctionSpec
): boolean => {
  if (spec.timeoutCounter !== -1) {
    if (spec.idleTimeout > 0 && spec.timeoutCounter > 0) {
      spec.timeoutCounter--
    }
    if (spec.timeoutCounter === 0) {
      return true
    }
  }
  return false
}

export const updateTimeoutCounter = (
  spec: BasedObservableFunctionSpec | BasedFunctionSpec
) => {
  if (spec.timeoutCounter !== -1) {
    spec.timeoutCounter =
      spec.idleTimeout === 0 ? -1 : Math.ceil(spec.idleTimeout / 1e3)
  }
}
