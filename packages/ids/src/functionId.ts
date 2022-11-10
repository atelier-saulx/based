import { hashCompact } from '@saulx/hash'

export const generateFunctionId = (name: string, envId?: string): string => {
  return 'fn' + hashCompact(envId ? name + envId : name, 8, true)
}

export default generateFunctionId
