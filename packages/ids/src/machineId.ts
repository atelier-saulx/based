import { hashCompact } from '@saulx/hash'

export const generateMachineId = (machineId: string): string => {
  return 'ma' + hashCompact(machineId)
}

export default generateMachineId
