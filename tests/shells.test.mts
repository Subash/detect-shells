import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cwd, platform } from 'node:process'
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
