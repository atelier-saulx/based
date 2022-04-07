// https://github.com/chalk/ansi-regex
// https://github.com/chalk/strip-ansi

const pattern = [
  '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
  '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))',
].join('|')

const re = new RegExp(pattern, 'g')

export const stripAnsi = (text: string) => {
  if (typeof text === 'undefined') return ''
  if (typeof text !== 'string') {
    throw new TypeError(`Expected a \`string\`, got \`${typeof text}\``)
  }

  return text.replace(re, '')
}
