import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { cwd, execPath, platform } from 'node:process'
import test from 'node:test'
import { getAvailableShells, launchShell } from '../lib/index.js'
import type { Shell } from '../lib/index.js'

test('getAvailableShells returns the shells on this system', async () => {
  const shells = await getAvailableShells()

  // macOS always has Terminal.app and windows always reports cmd, but a linux
  // CI runner legitimately has none of the eighteen terminals installed
  if (platform === 'darwin' || platform === 'win32') {
    assert.ok(shells.length > 0, 'expected at least one shell')
  }

  for (const shell of shells) {
    assert.equal(typeof shell.shell, 'string')
    assert.ok(shell.shell.length > 0)
    assert.ok(shell.path.length > 0)
  }
})

test('getAvailableShells sorts by name', async () => {
  const shells = await getAvailableShells()
  const names = shells.map(shell => shell.shell)

  assert.deepEqual(
    names,
    names.toSorted((a, b) => a.localeCompare(b))
  )
})

test('getAvailableShells caches', async () => {
  assert.equal(await getAvailableShells(), await getAvailableShells())
})

test('launchShell rejects when the executable is gone', async () => {
  const shell = { shell: 'Nope', path: '/nope' } as unknown as Shell

  await assert.rejects(() => launchShell(shell, cwd()), {
    message: /Could not find executable/,
  })
})

test('launchShell rejects when the shell cannot be started', async () => {
  // windows launches every shell through START with a shell, which succeeds
  // whatever the path turns out to be
  if (platform === 'win32') {
    return
  }

  // a file that exists but cannot be executed, so the spawn itself fails
  const path = join(await mkdtemp(join(tmpdir(), 'detect-shells-')), 'shell')
  await writeFile(path, '', { mode: 0o644 })

  // both of these are spawned directly rather than through `open`
  const shell = {
    shell: platform === 'darwin' ? 'Kitty' : 'GNOME Terminal',
    path,
    bundleID: 'net.kovidgoyal.kitty',
  } as unknown as Shell

  await assert.rejects(() => launchShell(shell, cwd()), {
    message: /Not permitted to start/,
  })
})

test('launchShell does not wait for the shell', async () => {
  // windows launches through START with a shell, which returns immediately
  if (platform === 'win32') {
    return
  }

  // a "shell" that ignores its arguments and outlives the launch by a while
  const dir = await mkdtemp(join(tmpdir(), 'detect-shells-'))
  const path = join(dir, 'shell')
  await writeFile(path, '#!/bin/sh\nsleep 30\n', { mode: 0o755 })

  const shell = {
    shell: platform === 'darwin' ? 'Kitty' : 'GNOME Terminal',
    path,
    bundleID: 'net.kovidgoyal.kitty',
  }

  // launch it from a child process and see whether that process is free to
  // exit, rather than being held open until the shell is done
  const child = spawn(
    execPath,
    [
      '-e',
      `require(${JSON.stringify(resolve('lib/index.js'))})` +
        `.launchShell(${JSON.stringify(shell)}, ${JSON.stringify(dir)})`,
    ],
    { stdio: 'inherit' }
  )

  const start = Date.now()
  const [code] = await once(child, 'exit')
  const elapsed = Date.now() - start

  assert.equal(code, 0)
  assert.ok(elapsed < 5000, `expected a prompt exit, took ${elapsed}ms`)
})
