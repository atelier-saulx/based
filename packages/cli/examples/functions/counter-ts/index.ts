export default async ({ update, based }) => {
  let cnt: number = 0

  // based.observe

  const int = setInterval(() => {
    // throw new Error('xxx')

    update({
      cnt: ++cnt,
      thisIsTs: true,
      YUZI: 'WAT!',
      spesh: 13,
    })
  }, 100)

  return () => clearInterval(int)
}
