import type { BasedFunctionSpec, BasedObservableFunctionSpec } from './types'

export const fnIsTimedOut = (
  spec: BasedObservableFunctionSpec | BasedFunctionSpec
): boolean => {
  if (spec.timeoutCounter !== -1) {
    if (spec.timeoutCounter === 0) {
      return true
    }
    if (spec.idleTimeout > 0 && spec.timeoutCounter > 0) {
      spec.timeoutCounter--
    }
  }
  return false
}

export const updateTimeoutCounter = (
  spec: BasedObservableFunctionSpec | BasedFunctionSpec
) => {
  if (spec.timeoutCounter !== -1) {
    spec.timeoutCounter =
      spec.idleTimeout === -1 ? -1 : Math.ceil(spec.idleTimeout / 1e3 / 3)
  }
}
