import { styleText } from 'node:util'

function dotindex(c: string) {
  const m = /\.[^.]*$/.exec(c)
  return m ? m.index + 1 : c.length
}

function strlen(str: string): number {
  return str.replace(/\u001b[^m]*m/g, '').length
}

function table(
  rows_: string[][],
  opts: { hsep?: string; align?: Array<'l' | 'r' | 'c' | '.'> },
) {
  if (!opts) opts = {}
  const hsep = opts.hsep
  const align = opts.align || []

  const dotsizes = rows_.reduce((acc: number[], row) => {
    row.forEach((c, ix) => {
      const n = align[ix] == '.' ? dotindex(c) : 0
      if (!acc[ix] || n > acc[ix]) acc[ix] = n
    })
    return acc
  }, [] as number[])

  const rows = rows_.map((row) => {
    return row.map((c_, ix) => {
      const c = String(c_)
      if (align[ix] === '.') {
        const index = dotindex(c)
        const size = dotsizes[ix] + (/\./.test(c) ? 1 : 2) - (strlen(c) - index)
        return c + Array(size).join(' ')
      } else return c
    })
  })

  const sizes = rows.reduce((acc, row) => {
    row.forEach((c, ix) => {
      const n = strlen(c)
      if (!acc[ix] || n > acc[ix]) acc[ix] = n
    })
    return acc
  }, [] as number[])

  return rows
    .map((row) => {
      return row
        .map((c, ix) => {
          const n = sizes[ix] - strlen(c) || 0
          const s = Array(Math.max(n + 1, 1)).join(' ')
          if (align[ix] === 'r' || align[ix] === '.') {
            return s + c
          }
          if (align[ix] === 'c') {
            return (
              Array(Math.ceil(n / 2 + 1)).join(' ') +
              c +
              Array(Math.floor(n / 2 + 1)).join(' ')
            )
          }

          return c + s
        })
        .join(hsep)
        .replace(/\s+$/, '')
    })
    .join('\n')
}

export function formatTable(
  header: string[],
  align: Array<'l' | 'r' | 'c' | '.'>,
  blocks: { name: string; rows: (string | number)[][] }[],
  hsep = '    ',
): string {
  const nrCols = header.length
  const padding = []
  let out = '\n'

  for (let i = 0; i < nrCols; i++) {
    padding[i] = blocks.reduce((acc, block) => {
      const maxLen = Math.max(...block.rows.map((row) => strlen(`${row[i]}`)))
      return Math.max(acc, Math.ceil(maxLen / 8))
    }, 1)
  }

  for (const block of blocks) {
    if (block.name) {
      out += `${styleText('bold', block.name)}\n`
    }

    // @ts-ignore
    const rows = [header.map((s) => styleText('dim', s))].concat(block.rows)
    if (rows.length > 0) {
      rows[0][0] = ` ${rows[0][0]}`

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i].slice(0)
        row[0] = ` ${row[0]}`
        for (let j = 0; j < nrCols; j++) {
          const col = `${row[j]}`
          const al = align[j] || 'l'
          const pad =
            padding[j] > 1 ? ' '.repeat(padding[j] * 8 - strlen(col)) : ''
          rows[i][j] = al === 'l' ? col + pad : pad + col
        }
      }
      out += table(rows, { align, hsep })
    }
    out += '\n\n'
  }

  return out.slice(0, -1)
}
