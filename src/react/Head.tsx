import { createElement, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

let firstTimeHeadOnClient = true
let isHydrating = true

export const meta = { isCalled: false }

export const Head = ({ children }) => {
  if (typeof window !== 'undefined') {
    if (firstTimeHeadOnClient) {
      document.head.innerHTML = document.head.innerHTML.replace(
        /<!-- x6Wa2 -->[^]*?<!-- x6Wa2 -->/g,
        '',
      )
      window.requestAnimationFrame(() => {
        isHydrating = false
      })
      firstTimeHeadOnClient = false
    }
    const [readyToRender, isReady] = useState(!isHydrating)
    useEffect(() => {
      isReady(true)
    }, [])
    if (!readyToRender) {
      return null
    }
    return createPortal(children, document.head)
  }
  meta.isCalled = true
  return createElement('tmphead', {
    children: children,
  })
}
