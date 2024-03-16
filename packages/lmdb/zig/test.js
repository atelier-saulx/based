const addon = require('./zig-out/lib/dist/lib.node')

console.log(addon)

console.log('go create db...', addon.createDb('./tmp'))

const d = Date.now()

const buf = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])

for (let i = 0; i < 1; i++) {
  addon.set('bla', buf)
}

console.log(Date.now() - d, 'ms')
