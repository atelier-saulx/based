import { MigrationState } from './types.js'

export const waitUntilSleeping = async (workerState: Int32Array) => {
  await Atomics.waitAsync(workerState, 0, MigrationState.AWAKE).value
}

export const setToAwake = (workerState: Int32Array, notify: boolean) => {
  workerState[0] = MigrationState.AWAKE
  if (notify) {
    Atomics.notify(workerState, 0)
  }
}

export const setToSleep = (workerState: Int32Array) => {
  workerState[0] = MigrationState.SLEEP
  Atomics.notify(workerState, 0)
  Atomics.wait(workerState, 0, MigrationState.SLEEP)
}
