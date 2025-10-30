import React, { ReactNode, FC } from 'react'
import { useClientOnly } from './useClientOnly.js'

export const ClientOnly = ({ children }: { children: ReactNode | FC<any> }) => {
  const client = useClientOnly()
  if (!client) return null
  return typeof children === 'function'
    ? React.createElement(children)
    : children
}
