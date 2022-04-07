import { hashCompact, hashObjectIgnoreKeyOrder } from '@saulx/hash'

export const generateServiceInstanceId = (
  machineId: string,
  name: string,
  env: string,
  org: string,
  project: string,
  args: { [key: string]: any }
): string => {
  const argsHash = hashObjectIgnoreKeyOrder(args).toString()
  return 'si' + hashCompact(machineId + name + env + org + project + argsHash)
}

export default generateServiceInstanceId
