const addon = require('./zig-out/lib/dist/lib.node')

console.log(addon)

console.log('go create db...', addon.createDb('./tmp'))

const d = Date.now()
for (let i = 0; i < 1; i++) {
  addon.set('bla', 'flap')
}

console.log(Date.now() - d, 'ms')
