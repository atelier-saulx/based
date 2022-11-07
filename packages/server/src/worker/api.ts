// external api
import { ClientContext } from '../types'
import { parentPort } from 'worker_threads'

export const runFunction = async (
  name: string,
  payload: any,
  context: ClientContext
) => {
  console.info('ok ok we are sending something!')
  // pare
}
