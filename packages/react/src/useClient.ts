import { useContext } from 'react'
import { BasedClient } from '@based/client'
import { Ctx } from './Ctx.js'

export const useClient = (): BasedClient => {
  return useContext(Ctx)
}
