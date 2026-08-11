import { ChildProcess } from 'node:child_process'
import { access } from 'node:fs/promises'
import * as Darwin from './shells/darwin'
import * as Linux from './shells/linux'
import * as Win32 from './shells/win32'

export type Shell = Darwin.FoundShell | Linux.FoundShell | Win32.FoundShell

let cache: readonly Shell[] | null = null

/** Shells installed on this system, sorted by name. */
export async function getAvailableShells(): Promise<readonly Shell[]> {
  if (!cache) {
    const shells = await detect()
    cache = shells.toSorted((a, b) => a.shell.localeCompare(b.shell))
  }

  return cache
}

/** Open the given shell at the given path. */
export async function launchShell(shell: Shell, path: string): Promise<void> {
  const exists = await access(shell.path).then(
    () => true,
    () => false
  )

  if (!exists) {
    throw new Error(
      `Could not find executable for '${shell.shell}' at path '${shell.path}'.`
    )
  }

  const shellProcess = launch(shell, path)

  return new Promise((resolve, reject) => {
    shellProcess.on('error', reject)
    resolve()
  })
}

function detect(): Promise<readonly Shell[]> {
  switch (process.platform) {
    case 'darwin':
      return Darwin.getAvailableShells()
    case 'linux':
      return Linux.getAvailableShells()
    case 'win32':
      return Win32.getAvailableShells()
    default:
      throw new Error(
        `Platform not currently supported for resolving shells: ${process.platform}`
      )
  }
}

function launch(shell: Shell, path: string): ChildProcess {
  // the platform decides which of the shell types is in hand, so the cast is
  // safe as long as the shell came from getAvailableShells
  switch (process.platform) {
    case 'darwin':
      return Darwin.launch(shell as Darwin.FoundShell, path)
    case 'linux':
      return Linux.launch(shell as Linux.FoundShell, path)
    case 'win32':
      return Win32.launch(shell as Win32.FoundShell, path)
    default:
      throw new Error(
        `Platform not currently supported for launching shells: ${process.platform}`
      )
  }
}
