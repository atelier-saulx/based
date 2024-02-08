export const basedSchemaNumberFormats = [
  ,
  'short',
  'human',
  'ratio',
  'bytes',
  'euro',
  'dollar',
  'pound',
] as const
export type NumberFormat =
  | (typeof basedSchemaNumberFormats)[number]
  | `round-${number}`

const parseNumber = (
  nr: number | string,
  format?: NumberFormat
): string | number => {
  if (!format) {
    return nr
  }

  if (typeof nr === 'number') {
    if (format === 'euro' || format === 'dollar' || format === 'pound') {
      const p = String(parseNumber(nr, 'short'))
      const fraction = format === 'euro' ? ',' : '.'

      const [s, f] = p.split('.')

      return `${
        format === 'euro'
          ? '€'
          : format === 'pound'
          ? '£'
          : format === 'dollar'
          ? '$'
          : ''
      }${s}${f ? `${fraction}${f}` : ''}`
    } else if (format.startsWith('round-')) {
      const [, fixed] = format.split('round-')
      const n = Number(fixed)
      if (!n) {
        return `${nr.toFixed()}`
      }
      return `${nr.toFixed(n)}`
    } else if (format === 'bytes') {
      const kb = nr / 1024
      const mb = kb / 1024
      const gb = mb / 1024

      if (gb >= 1) {
        return `${gb.toFixed(2)} gb`
      } else if (mb >= 1) {
        return `${mb.toFixed(2)} mb`
      } else if (kb >= 1) {
        return `${kb.toFixed(2)} kb`
      } else {
        return `${nr} ${nr === 1 ? 'byte' : 'bytes'}`
      }
    } else if (format === 'ratio') {
      return `${Math.round(nr * 10000) / 100}%`
    } else if (format === 'short') {
      if (nr >= 10e9) {
        nr = nr / 1e9
        nr = nr.toFixed(1)
        if (nr[nr.length - 1] === '0') {
          nr = nr.slice(0, -2)
        }
        return nr + 'b'
      } else if (nr >= 10e6) {
        nr = nr / 1e6
        nr = nr.toFixed(1)
        if (nr[nr.length - 1] === '0') {
          nr = nr.slice(0, -2)
        }
        return nr + 'm'
      } else if (nr >= 10e3) {
        nr = nr / 1e3
        nr = nr.toFixed(1)
        if (nr[nr.length - 1] === '0') {
          nr = nr.slice(0, -2)
        }
        return nr + 'k'
      }
      nr = nr.toFixed(2)
      if (nr[nr.length - 1] === '0') {
        nr = nr.slice(0, -3)
      }
      return String(nr)
    } else if (format === 'human') {
      return nr.toFixed(2)
    }
    return String(nr)
  } else {
    return nr
  }
}

export default parseNumber
