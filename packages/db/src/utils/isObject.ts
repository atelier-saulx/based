export default function isObject(item: any): boolean {
  return item && typeof item === 'object' && item.constructor !== Array
}
