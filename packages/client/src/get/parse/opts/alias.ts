export function parseAlias(value: any): string[] | undefined {
  let $field = value.$field
  if (!$field) {
    return
  }

  if (!Array.isArray(value.$field)) {
    $field = [$field]
  }

  return $field
}
