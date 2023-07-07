import { useContext } from 'react'
import { BasedClient } from '@based/client'
import { Ctx } from './Ctx'

export const useClient = (): BasedClient => {
  return useContext(Ctx)
}
