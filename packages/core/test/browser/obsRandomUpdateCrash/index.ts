export default async (payload, update) => {
  let cnt = 0

  update({ cnt: ++cnt })

  const interval = setInterval(() => {
    if (Math.random() > 0.75) {
      throw new Error('RANDO CRASH!')
    }

    update({ cnt: ++cnt })
  }, 100)
  return () => {
    clearInterval(interval)
  }
}
