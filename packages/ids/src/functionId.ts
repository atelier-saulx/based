import { hashCompact } from '@saulx/hash'

export const generateFunctionId = (name: string, envId: string): string => {
  return 'fn' + hashCompact(name + envId, 8, true)
}

export default generateFunctionId
