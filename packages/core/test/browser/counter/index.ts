console.info('Install... counter!')

export default async (payload, update) => {
  let cnt = 0
  const interval = setInterval(() => {
    let lotsOfThings = ''
    for (let i = 0; i < 1; i++) {
      lotsOfThings += 'OK! GUR ' + Math.random()
    }
    update({ cnt: ++cnt, lotsOfThings })
  }, 2e3)
  return () => {
    clearInterval(interval)
  }
}
