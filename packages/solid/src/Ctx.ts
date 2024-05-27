import { createContext } from 'react'
import { BasedClient } from 'packages/client/src'

export const Ctx = createContext<BasedClient>(null)
