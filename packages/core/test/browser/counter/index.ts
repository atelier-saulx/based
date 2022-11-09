export default async (payload, update) => {
  let cnt = 0

  update({ cnt: ++cnt })

  const interval = setInterval(() => {
    let lotsOfThings = ''
    for (let i = 0; i < 1; i++) {
      lotsOfThings += 'OK! GUxxR ' + Math.random()
    }
    update({ cnt: ++cnt, lotsOfThings })
  }, 5e3)
  return () => {
    clearInterval(interval)
  }
}
