// ported from desktop/desktop app/src/lib/shells/win32.ts
// see src/shells/upstream.json and UPDATING.md to re-sync

import { spawn, ChildProcess } from 'node:child_process'
import { access } from 'node:fs/promises'
import * as Path from 'node:path'
import {
  enumerateValues,
  HKEY,
  RegistryValue,
  RegistryValueType,
} from 'registry-js'

export const Shell = {
  Cmd: 'Command Prompt',
  PowerShell: 'PowerShell',
  PowerShellCore: 'PowerShell Core',
  Hyper: 'Hyper',
  GitBash: 'Git Bash',
  Cygwin: 'Cygwin',
  WindowsTerminal: 'Windows Terminal',
  FluentTerminal: 'Fluent Terminal',
  Alacritty: 'Alacritty',
  Warp: 'Warp',
} as const

export type Shell = (typeof Shell)[keyof typeof Shell]

export interface FoundShell {
  readonly shell: Shell
  readonly path: string
  readonly extraArgs?: ReadonlyArray<string>
}

function pathExists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false
  )
}

/**
 * `where` will list _all_ PATH components where the executable is found, one
 * per line, and return 0, or print an error and return 1 if it cannot be found.
 *
 * adapted from http://stackoverflow.com/a/34953561/1363815
 */
function findGitOnPath(): Promise<string | undefined> {
  const windowsRoot = process.env.SystemRoot || 'C:\\Windows'
  const wherePath = Path.join(windowsRoot, 'System32', 'where.exe')

  return new Promise(resolve => {
    const cp = spawn(wherePath, ['git'], { cwd: windowsRoot })
    const chunks = new Array<Buffer>()

    cp.on('error', () => resolve(undefined))
    cp.stdout.on('data', (chunk: Buffer) => chunks.push(chunk))
    cp.on('close', code => {
      if (code !== 0) {
        resolve(undefined)
      } else {
        // only the first line, the closest match on PATH
        resolve(
          Buffer.concat(chunks)
            .toString()
            .replace(/\r?\n[^]*/m, '')
        )
      }
    })
  })
}

export async function getAvailableShells(): Promise<ReadonlyArray<FoundShell>> {
  const gitPath = await findGitOnPath()
  const rootDir = process.env.WINDIR || 'C:\\Windows'
  const dosKeyExePath = `"${rootDir}\\system32\\doskey.exe git=^"${gitPath}^" $*"`
  const shells: FoundShell[] = [
    {
      shell: Shell.Cmd,
      path: process.env.comspec || 'C:\\Windows\\System32\\cmd.exe',
      extraArgs: gitPath ? ['/K', dosKeyExePath] : [],
    },
  ]

  const powerShellPath = await findPowerShell()
  if (powerShellPath != null) {
    shells.push({
      shell: Shell.PowerShell,
      path: powerShellPath,
    })
  }

  const powerShellCorePath = await findPowerShellCore()
  if (powerShellCorePath != null) {
    shells.push({
      shell: Shell.PowerShellCore,
      path: powerShellCorePath,
    })
  }

  const hyperPath = await findHyper()
  if (hyperPath != null) {
    shells.push({
      shell: Shell.Hyper,
      path: hyperPath,
    })
  }

  const gitBashPath = await findGitBash()
  if (gitBashPath != null) {
    shells.push({
      shell: Shell.GitBash,
      path: gitBashPath,
    })
  }

  const cygwinPath = await findCygwin()
  if (cygwinPath != null) {
    shells.push({
      shell: Shell.Cygwin,
      path: cygwinPath,
    })
  }

  const warpPath = await findWarp()
  if (warpPath != null) {
    shells.push({
      shell: Shell.Warp,
      path: warpPath,
    })
  }

  const alacrittyPath = await findAlacritty()
  if (alacrittyPath != null) {
    shells.push({
      shell: Shell.Alacritty,
      path: alacrittyPath,
    })
  }

  const windowsTerminal = await findWindowsTerminal()
  if (windowsTerminal != null) {
    shells.push({
      shell: Shell.WindowsTerminal,
      path: windowsTerminal,
    })
  }

  const fluentTerminal = await findFluentTerminal()
  if (fluentTerminal != null) {
    shells.push({
      shell: Shell.FluentTerminal,
      path: fluentTerminal,
    })
  }
  return shells
}

async function findPowerShell(): Promise<string | null> {
  const powerShell = enumerateValues(
    HKEY.HKEY_LOCAL_MACHINE,
    'Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\PowerShell.exe'
  )

  if (powerShell.length === 0) {
    return null
  }

  const first = powerShell[0]

  // NOTE:
  // on Windows 7 these are both REG_SZ, which technically isn't supposed
  // to contain unexpanded references to environment variables. But given
  // it's also %SystemRoot% and we do the expanding here I think this is
  // a fine workaround to do to support the maximum number of setups.

  if (
    first.type === RegistryValueType.REG_EXPAND_SZ ||
    first.type === RegistryValueType.REG_SZ
  ) {
    const path = first.data.replace(
      /^%SystemRoot%/i,
      process.env.SystemRoot || 'C:\\Windows'
    )

    if (await pathExists(path)) {
      return path
    }
  }

  return null
}

async function findPowerShellCore(): Promise<string | null> {
  const powerShellCore = enumerateValues(
    HKEY.HKEY_LOCAL_MACHINE,
    'Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\pwsh.exe'
  )

  if (powerShellCore.length === 0) {
    return null
  }

  const first = powerShellCore[0]
  if (first.type === RegistryValueType.REG_SZ) {
    const path = first.data

    if (await pathExists(path)) {
      return path
    }
  }

  return null
}

async function findHyper(): Promise<string | null> {
  const hyper = enumerateValues(
    HKEY.HKEY_CURRENT_USER,
    'Software\\Classes\\Directory\\Background\\shell\\Hyper\\command'
  )

  if (hyper.length === 0) {
    return null
  }

  const first = hyper[0]
  if (first.type === RegistryValueType.REG_SZ) {
    // Registry key is structured as "{installationPath}\app-x.x.x\Hyper.exe" "%V"

    // This regex is designed to get the path to the version-specific Hyper.
    // commandPieces = ['"{installationPath}\app-x.x.x\Hyper.exe"', '"', '{installationPath}\app-x.x.x\Hyper.exe', ...]
    const commandPieces = first.data.match(/(["'])(.*?)\1/)
    const localAppData = process.env.LocalAppData

    const path = commandPieces
      ? commandPieces[2]
      : localAppData != null
      ? localAppData.concat('\\hyper\\Hyper.exe')
      : null // fall back to the launcher in install root

    if (path != null && (await pathExists(path))) {
      return path
    }
  }

  return null
}

async function findGitBash(): Promise<string | null> {
  const registryPath = enumerateValues(
    HKEY.HKEY_LOCAL_MACHINE,
    'SOFTWARE\\GitForWindows'
  )

  if (registryPath.length === 0) {
    return null
  }

  const installPathEntry = registryPath.find(e => e.name === 'InstallPath')
  if (installPathEntry && installPathEntry.type === RegistryValueType.REG_SZ) {
    const path = Path.join(installPathEntry.data, 'git-bash.exe')

    if (await pathExists(path)) {
      return path
    }
  }

  return null
}

async function findCygwin(): Promise<string | null> {
  const registryPath64 = enumerateValues(
    HKEY.HKEY_LOCAL_MACHINE,
    'SOFTWARE\\Cygwin\\setup'
  )
  const registryPath32 = enumerateValues(
    HKEY.HKEY_LOCAL_MACHINE,
    'SOFTWARE\\WOW6432Node\\Cygwin\\setup'
  )

  if (registryPath64 == null || registryPath32 == null) {
    return null
  }

  const installPathEntry64 = registryPath64.find(e => e.name === 'rootdir')
  const installPathEntry32 = registryPath32.find(e => e.name === 'rootdir')
  if (
    installPathEntry64 &&
    installPathEntry64.type === RegistryValueType.REG_SZ
  ) {
    const path = Path.join(installPathEntry64.data, 'bin\\mintty.exe')

    if (await pathExists(path)) {
      return path
    } else if (
      installPathEntry32 &&
      installPathEntry32.type === RegistryValueType.REG_SZ
    ) {
      const path = Path.join(installPathEntry32.data, 'bin\\mintty.exe')
      if (await pathExists(path)) {
        return path
      }
    }
  }

  return null
}

async function findOldWarp(
  warpRegistry: readonly RegistryValue[]
): Promise<string | null> {
  if (!warpRegistry || warpRegistry.length === 0) {
    return null
  }

  const localAppData = process.env.LocalAppData
  const programFiles = process.env.ProgramFiles
  const programFilesx86 = process.env['ProgramFiles(x86)']

  // If all environment variables are unset, return null
  if (!localAppData && !programFiles && !programFilesx86) {
    return null
  }

  const warpPathLocalAppData = localAppData
    ? Path.join(localAppData, 'warp', 'Warp', 'warp.exe')
    : null
  const warpPathProgramFiles = programFiles
    ? Path.join(programFiles, 'Warp', 'warp.exe')
    : null
  const warpPathProgramFilesx86 = programFilesx86
    ? Path.join(programFilesx86, 'Warp', 'warp.exe')
    : null

  // If any of the paths exist, return it
  if (warpPathLocalAppData && (await pathExists(warpPathLocalAppData))) {
    return warpPathLocalAppData
  } else if (warpPathProgramFiles && (await pathExists(warpPathProgramFiles))) {
    return warpPathProgramFiles
  } else if (
    warpPathProgramFilesx86 &&
    (await pathExists(warpPathProgramFilesx86))
  ) {
    return warpPathProgramFilesx86
  }

  return null
}

async function findWarp(): Promise<string | null> {
  const warpRegistry = enumerateValues(
    HKEY.HKEY_CURRENT_USER,
    'Software\\Warp.dev\\Warp' // Get warp installation path
  )

  if (!warpRegistry || warpRegistry.length === 0) {
    return null
  }

  const warpInstallationPath = warpRegistry.find(
    e => e.name === 'InstallationPath'
  )
  if (
    !warpInstallationPath ||
    warpInstallationPath.type !== RegistryValueType.REG_SZ
  ) {
    return await findOldWarp(warpRegistry)
  }

  // If any of the paths exist, return it
  if (await pathExists(warpInstallationPath.data)) {
    return warpInstallationPath.data
  }

  return await findOldWarp(warpRegistry)
}

async function findAlacritty(): Promise<string | null> {
  const registryPath = enumerateValues(
    HKEY.HKEY_CLASSES_ROOT,
    'Directory\\Background\\shell\\Open Alacritty here'
  )

  if (registryPath.length === 0) {
    return null
  }

  const alacritty = registryPath.find(e => e.name === 'Icon')
  if (alacritty && alacritty.type === RegistryValueType.REG_SZ) {
    const path = alacritty.data
    if (await pathExists(path)) {
      return path
    }
  }

  return null
}

async function findWindowsTerminal(): Promise<string | null> {
  // Windows Terminal has a link at
  // C:\Users\<User>\AppData\Local\Microsoft\WindowsApps\wt.exe
  const localAppData = process.env.LocalAppData
  if (localAppData != null) {
    const windowsTerminalpath = Path.join(
      localAppData,
      '\\Microsoft\\WindowsApps\\wt.exe'
    )
    if (await pathExists(windowsTerminalpath)) {
      return windowsTerminalpath
    }
  }
  return null
}

async function findFluentTerminal(): Promise<string | null> {
  // Fluent Terminal has a link at
  // C:\Users\<User>\AppData\Local\Microsoft\WindowsApps\flute.exe
  const localAppData = process.env.LocalAppData
  if (localAppData != null) {
    const fluentTerminalpath = Path.join(
      localAppData,
      '\\Microsoft\\WindowsApps\\flute.exe'
    )
    if (await pathExists(fluentTerminalpath)) {
      return fluentTerminalpath
    }
  }
  return null
}

export function launch(foundShell: FoundShell, path: string): ChildProcess {
  const shell = foundShell.shell

  switch (shell) {
    case Shell.PowerShell:
      return spawn('START', ['"PowerShell"', `"${foundShell.path}"`], {
        shell: true,
        cwd: path,
      })
    case Shell.PowerShellCore:
      return spawn(
        'START',
        [
          '"PowerShell Core"',
          `"${foundShell.path}"`,
          '-WorkingDirectory',
          `"${path}"`,
        ],
        {
          shell: true,
          cwd: path,
        }
      )
    case Shell.Hyper:
      const hyperPath = `"${foundShell.path}"`
      return spawn(hyperPath, [`"${path}"`], {
        shell: true,
        cwd: path,
      })
    case Shell.Alacritty:
      const alacrittyPath = `"${foundShell.path}"`
      return spawn(alacrittyPath, [`--working-directory "${path}"`], {
        shell: true,
        cwd: path,
      })
    case Shell.GitBash:
      const gitBashPath = `"${foundShell.path}"`
      return spawn(gitBashPath, [`--cd="${path}"`], {
        shell: true,
        cwd: path,
      })
    case Shell.Cygwin:
      const cygwinPath = `"${foundShell.path}"`
      return spawn(
        cygwinPath,
        [`/bin/sh -lc 'cd "$(cygpath "${path}")"; exec bash`],
        {
          shell: true,
          cwd: path,
        }
      )
    case Shell.Warp:
      const warpPath = `"${foundShell.path}"`
      return spawn(warpPath, [`warp://action/new_tab?path="${path}"`], {
        shell: true,
        cwd: path,
      })
    case Shell.Cmd:
      return spawn(
        'START',
        ['"Command Prompt"', `"${foundShell.path}"`, ...foundShell.extraArgs!],
        {
          shell: true,
          cwd: path,
        }
      )
    case Shell.WindowsTerminal:
      const windowsTerminalPath = `"${foundShell.path}"`
      return spawn(windowsTerminalPath, ['-d .'], { shell: true, cwd: path })
    case Shell.FluentTerminal:
      const fluentTerminalPath = `"${foundShell.path}"`
      return spawn(fluentTerminalPath, ['new'], { shell: true, cwd: path })
    default: {
      const unknown: never = shell
      throw new Error(`Unknown shell: ${unknown}`)
    }
  }
}
