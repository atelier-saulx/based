import { red, blue, green } from 'yoctocolors'

export const stripAnsi = (text: string) =>
  text.replace(
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    '',
  )

export const printError = (message: string, error?: Error) => {
  console.error(red('! Error: ' + message))
  if (error) {
    console.error(red(error.message))
  }
}
