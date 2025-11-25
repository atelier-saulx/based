import { createRequire } from 'node:module'
import { platform, arch } from 'node:os'

const require = createRequire(import.meta.url)
const build = `${platform()}_${arch() === 'arm64' ? 'aarch64' : 'x86_64'}`

export default require(
  `../dist/lib/${build}/libbased-${process.versions.napi}.node`,
)
