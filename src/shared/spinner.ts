import ora, { Ora } from 'ora'
export const spinner: Ora = ora({ discardStdin: false, hideCursor: true })
