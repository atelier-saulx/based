import { createElement, FC, ReactNode } from 'react'
import { BasedClient } from '@based/client'
import { Ctx } from './Ctx.js'

export const Provider: FC<{
  client: BasedClient
  children: ReactNode
}> = ({ client, children }) => {
  return createElement(Ctx.Provider, { value: client }, children)
}
