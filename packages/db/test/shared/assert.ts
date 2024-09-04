import { deepEqual as uDeepEqual } from '@saulx/utils'
import util from 'node:util'

export const deepEqual = (a, b, msg?: string) => {
  if (!uDeepEqual(a, b)) {
    const m = `${msg || ``}
------------------ EXPECTED ----------------------
${util.inspect(b)}
------------------- ACTUAL -----------------------
${util.inspect(a)}
--------------------------------------------------`
    throw new Error(m)
  }
}

export const equal = deepEqual
