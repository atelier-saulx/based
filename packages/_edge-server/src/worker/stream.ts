import { Incoming, IncomingType } from '../types'

// const MAX_STRING = buffer.constants.MAX_STRING_LENGTH

// fix stream right here...

// fix the cient context
// standard thing - with a type make it easier
// lot to share

// failing things

/*
Atomics.waitAsync(typedArray, index, value)
Atomics.waitAsync(typedArray, index, value, timeout)

  const res = destination.write(toWrite)

  if (res) {
    Atomics.store(state, READ_INDEX, end)
    Atomics.notify(state, READ_INDEX)
    setImmediate(run)
  } else {
    destination.once('drain', function () {
      Atomics.store(state, READ_INDEX, end)
      Atomics.notify(state, READ_INDEX)
      run()
    })
  }

  function write (stream, data, cb) {
  // data is smaller than the shared buffer length
  const current = Atomics.load(stream[kImpl].state, WRITE_INDEX)
  const length = Buffer.byteLength(data)
  stream[kImpl].data.write(data, current)
  Atomics.store(stream[kImpl].state, WRITE_INDEX, current + length)
  Atomics.notify(stream[kImpl].state, WRITE_INDEX)
  cb()
  return true
}

opts.bufferSize || 4 * 1024 * 1024

// this[kImpl].stateBuf = new SharedArrayBuffer(128)


// then write on state from the worker and the other way arround
*/

export default (msg: Incoming[IncomingType.Stream]) => {
  console.info('Incoming stream fn go go gog ', msg)
}
