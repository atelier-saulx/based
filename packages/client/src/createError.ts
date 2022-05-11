import { ErrorObject, BasedError } from '@based/types'
import printBasedObject, { color } from './printBasedObject'

export default (err: ErrorObject): BasedError => {
  const x = new BasedError(err.message)
  x.name = err.name ? `${err.type} from ${err.name}` : err.type
  x.stack = null

  if (err.query || err.payload) {
    let lines = x.message.split('\n')
    let correction = 0
    if (lines[0] === '') {
      lines.shift()
    }

    const firstLine = lines[0]
    for (let i = 0; i < firstLine.length; i++) {
      if (firstLine[i] !== ' ') {
        correction = i - 2
        break
      }
    }
    if (correction > 0) {
      lines = lines.map((v) => v.slice(correction))
    } else {
      lines = lines.map((v) => '  ' + v)
    }
    if (err.code) {
      x.code = err.code
    }
    x.message =
      '\n\n' +
      (err.payload && typeof err.payload !== 'object'
        ? `  ${color('Payload', 'brightRed')} ${err.payload}`
        : printBasedObject(
            err.payload || err.query,
            0,
            false,
            err.payload ? 'Payload' : 'Query',
            true
          )
            .map((v) => '  ' + v)
            .join('\n')) +
      '\n\n' +
      lines.join('\n') +
      '\n\n'
  }
  return x
}
