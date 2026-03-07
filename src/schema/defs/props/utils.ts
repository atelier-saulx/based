export const validateMaxBytes = (
  bytes: number,
  prop: { maxBytes?: number },
  path: string[],
) => {
  if (prop.maxBytes !== undefined) {
    if (bytes > prop.maxBytes) {
      throw new Error(
        `Byte length ${bytes} is larger than maxBytes ${
          prop.maxBytes
        } for ${path.join('.')}`,
      )
    }
  }
}
