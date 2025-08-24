export function fastPrng(seed: number = 100) {
  return (min: number, max: number) => {
    seed = (214013 * seed + 2531011) & 0xFFFFFFFF
    return ((seed >> 16) & 0x7FFF) % (max - min + 1) + min
  }
}
