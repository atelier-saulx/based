import { createContext } from 'react'
import type { BasedClient } from '../client/index.js'

export const Ctx = createContext<BasedClient>(null as any)
