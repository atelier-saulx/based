const MAX = 2_147_483_647

const recursiveTimeout = (onTimeout: () => void, ms: number, ctx: any) => {
  const currentTimer = setTimeout(() => {
    if (ms > MAX) {
      return recursiveTimeout(onTimeout, ms - MAX, ctx)
    } else {
      onTimeout()
    }
  }, Math.min(MAX, ms))
  ctx.timer = currentTimer
}

export const setLongTimeout = (onTimeout: () => void, ms: number) => {
  const ctx = { timer: null }

  recursiveTimeout(onTimeout, ms, ctx)
  return () => {
    clearTimeout(ctx.timer)
  }
}
