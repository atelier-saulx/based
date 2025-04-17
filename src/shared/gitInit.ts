import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)
import { ensureDirSafe } from './index.js'

export const gitInit = async (path: string) => {
  const ok = await ensureDirSafe(path)

  if (!ok) {
    throw new Error(`Directory does not exist or is invalid: ${path}`)
  }

  try {
    await execAsync('git init --initial-branch=main', { cwd: path })
    await execAsync('git commit --allow-empty -m "Initial commit"', {
      cwd: path,
    })
  } catch (err) {
    throw new Error(
      `Failed to initialize git repo at ${path}: ${(err as Error).message}`,
    )
  }
}
