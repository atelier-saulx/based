import { hashCompact, hashObjectIgnoreKeyOrder } from '@saulx/hash'

export const generateServiceId = (
  name: string,
  env: string,
  org: string,
  project: string,
  args: { [key: string]: any }
): string => {
  const argsHash = hashObjectIgnoreKeyOrder(args).toString()
  return 'se' + hashCompact(name + env + org + project + argsHash)
}

export default generateServiceId
