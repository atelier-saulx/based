// import flap from './flap'
import { hash } from '@saulx/hash'

export default async ({ update, based }) => {
  let cnt = 0

  const obj = {}

  const closeOther = based.observe('x', (d) => {
    obj.data = d
  })

  const int = setInterval(async () => {
    const mychildren = await based.get({
      children: {
        $all: true,
        $list: true,
      },
    })
    update({
      cnt: ++cnt,
      y: 'xx',
      x: hash(cnt),
      mychildren,
      obj,
    })
  }, 1000)
  return () => {
    clearInterval(int)
    closeOther()
  }
}
