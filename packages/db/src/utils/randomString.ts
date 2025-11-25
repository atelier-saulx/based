/**
 * Create string of random character of specified length
 * @param length length of required string
 * @param opts By default, all chars are allowed. It's possible to disable certain chars using these options.
 * Options are `specials` `lowerCase` `upperCase` `numbers`
 */
export default function randomString(
  length: number,
  opts?: {
    noSpecials?: boolean;
    noLowerCase?: boolean;
    noUpperCase?: boolean;
    noNumbers?: boolean;
  }
) {
  const noSpecials = opts && opts.noSpecials || false
  const noLowerCase = opts && opts.noLowerCase || false
  const noUpperCase = opts && opts.noUpperCase || false
  const noNumbers = opts && opts.noNumbers || false

  const upperCaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lowerCaseChars = 'abcdefghijklmnopqrstuvwxyz'
  const numberChars = '0123456789'
  const specialsChars = '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~'
  let dictionary: string = ''
  if (!noSpecials) {
    dictionary += specialsChars
  }
  if (!noLowerCase) {
    dictionary += lowerCaseChars
  }
  if (!noUpperCase) {
    dictionary += upperCaseChars
  }
  if (!noNumbers) {
    dictionary += numberChars
  }

  let result = ''
  const charactersLength = dictionary.length
  for (let i = 0; i < length; i++) {
    result += dictionary.charAt(Math.floor(Math.random() * charactersLength))
  }
  return result
}
