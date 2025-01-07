export const isValidId = (id: number): void => {
  if (typeof id != 'number' || id < 1) {
    throw new Error('Id has to be a number')
  }
}
