import type { BasedSpec } from './types'

export const fnIsTimedOut = (spec: BasedSpec): boolean => {
  if (spec.timeoutCounter !== -1) {
    if (spec.timeoutCounter === 0) {
      return true
    }
    if (spec.uninstallAfterIdleTime > 0 && spec.timeoutCounter > 0) {
      spec.timeoutCounter--
    }
  }
  return false
}

export const updateTimeoutCounter = (spec: BasedSpec) => {
  if (spec.timeoutCounter !== -1) {
    spec.timeoutCounter =
      spec.uninstallAfterIdleTime === -1
        ? -1
        : Math.ceil(spec.uninstallAfterIdleTime / 1e3 / 3)
  }
}
