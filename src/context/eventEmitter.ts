// import EventEmitter from 'node:events'

// export const eventEmitter = new EventEmitter()

// process.stdin.resume()
// process.stdin.setRawMode(true)

// process.stdin.on('data', (buf) => {
//   const seq = buf.toString('utf8')

//   if (seq === '\u0003') {
//     return process.stdin.pause()
//   }

//   const isMouse = seq.startsWith('\x1B[<')
//   const isKeyboard = seq.startsWith('\x1B[')

//   if (isMouse) {
//     parseMouseWheelEvent(buildEvent(seq))
//   } else if (isKeyboard) {
//     parseKeyEvent(seq)
//   }
// })

// const buildEvent = (sequence: string): Based.Context.MouseEvent => {
//   const [btn, x, y] = sequence.slice(3, -1).split(';').map(Number)
//   const event: Based.Context.MouseEvent = {} as Based.Context.MouseEvent

//   event.button = btn & 0b11000011
//   event.state = sequence.at(-1) === 'M' ? 'pressed' : 'released'
//   event.x = x
//   event.y = y
//   event.motion = !!(btn & 0b00100000)
//   event.shift = !!(btn & 0b00000100)
//   event.meta = !!(btn & 0b00001000)
//   event.ctrl = !!(btn & 0b00010000)

//   return event
// }

// const parseMouseWheelEvent = ({ button }: Based.Context.MouseEvent) => {
//   switch (button) {
//     // UP
//     case 64:
//       eventEmitter.emit('directions', {
//         name: 'up',
//         from: 'wheel',
//       } as Based.Context.DirectionsEvent)
//       break

//     // DOWN
//     case 65:
//       eventEmitter.emit('directions', {
//         name: 'down',
//         from: 'wheel',
//       } as Based.Context.DirectionsEvent)
//       break

//     default:
//       break
//   }
// }

// const parseKeyEvent = (sequence: string) => {
//   switch (sequence) {
//     // UP
//     case '\x1B[A':
//       eventEmitter.emit('directions', {
//         name: 'up',
//         from: 'keyboard',
//       } as Based.Context.DirectionsEvent)
//       break

//     // DOWN
//     case '\x1B[B':
//       eventEmitter.emit('directions', {
//         name: 'down',
//         from: 'keyboard',
//       } as Based.Context.DirectionsEvent)
//       break

//     // RIGHT
//     case '\x1B[C':
//       eventEmitter.emit('directions', {
//         name: 'right',
//         from: 'keyboard',
//       } as Based.Context.DirectionsEvent)
//       break

//     // LEFT
//     case '\x1B[D':
//       eventEmitter.emit('directions', {
//         name: 'left',
//         from: 'keyboard',
//       } as Based.Context.DirectionsEvent)
//       break

//     default:
//       break
//   }
// }
