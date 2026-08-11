import assert from 'node:assert/strict'
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
