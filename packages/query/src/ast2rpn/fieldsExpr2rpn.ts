export default function fieldsExpr2rpn(
  types: Record<string, { prefix?: string }>,
  t: {
    [typeName: string]: string // find fields string syntax
  }
): string {
  let label = 1
  let rpn: string[] = []

  for (const typeName in t) {
    if (typeName === '$any') {
      continue
    }

    const rule = t[typeName]
    const typePrefix = typeName === 'root' ? 'ro' : types[typeName].prefix

    rpn.push(`"${typePrefix}" e L >${label} "${rule}" Z .${label}`)
    label++
  }

  return `${rpn.length ? rpn.join(':') + ':' : ''}"${t.$any}"`
}
