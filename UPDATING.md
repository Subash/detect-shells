# Re-porting the shells code from GitHub Desktop

`src/shells/` is a port of [desktop/desktop](https://github.com/desktop/desktop)'s
`app/src/lib/shells`. Upstream is Electron app code carrying its own helpers,
logging and feature flags; this package keeps the terminal knowledge and drops the
scaffolding.

Keep upstream's structure line for line — same functions, order, control flow,
variable names, comments — so the next sync is a readable diff. The freedom is in
what to drop, not how to arrange what stays.

Last synced commit: `src/shells/upstream.json`.

## Contract

`src/index.ts` keeps exporting, unchanged:

```ts
export type Shell // at minimum { shell: string; path: string }
export function getAvailableShells(): Promise<readonly Shell[]> // sorted by name, cached
export function launchShell(shell: Shell, path: string): Promise<void> // rejects if the shell could not be started
```

Adding a field to a returned shell is a minor bump; removing one or changing a
signature is major, and not something a sync does as a side effect.

Launching is fire and forget. `launchShell` settles on whether the shell started
— a missing executable or a failed spawn rejects — and nothing after that is this
package's business. The shell is detached with its output ignored and the handle
unref'd, so a caller is free to exit while it is still running. There is a test
for this; don't regress it by reading a launched process's output.

## Layout

```
src/index.ts                       public API, dispatch, cache, sort
src/shells/{darwin,linux,win32}.ts Shell, FoundShell, getAvailableShells, launch
```

Each platform file is self-contained — node plus the two runtime deps, nothing
else. Duplicating a five-line `pathExists` beats a module they share.

Format with upstream's own prettier settings, pinned to 2.x (3 reindents nested
ternaries, which is noise in the files you diff):

```bash
npx prettier@2 --single-quote --trailing-comma es5 --no-semi --arrow-parens avoid --write src tests
```

## 1. Fetch

```bash
gh api repos/desktop/desktop/commits/development --jq '.sha, .commit.committer.date'
gh api repos/desktop/desktop/contents/app/src/lib/shells/<name>?ref=<sha> --jq .content | base64 -d
```

Stop if the sha already matches `upstream.json`. Always pin the sha, never
`development`. Read the files; don't write them into `src/`.

## 2. Port

Copy the data verbatim — install paths, bundle IDs, registry keys, launch
arguments, and the comments explaining workarounds. A wrong one is a bug nobody
notices on the wrong OS.

Keep the repetition: the eighteen `case` arms, the eighteen-way `Promise.all`, the
eighteen `if (xPath)` pushes, the per-arm `const hyperPath`. A `Record` map reads
better and turns the next sync into a rewrite. Don't merge near-identical functions
either — `findWindowsTerminal` and `findFluentTerminal` differ by one filename and
stay separate.

Deviations are a closed list. Anything else is a bug in the port:

| deviation | reason |
| --- | --- |
| two-line provenance header | points at `upstream.json` and this file |
| `enum` → `as const` object + type alias | `erasableSyntaxOnly`; see below |
| `FoundShell` declared per platform file | upstream's generic lived in a `shared.ts` this package doesn't have |
| `assertNever(x, msg)` → `const unknown: never = shell` | no `fatal-error.ts` |
| `pathExists` / `findGitOnPath` inlined | no support modules |
| every launch `spawn` goes through a local detached, stdio-ignoring wrapper | shells are fired and forgotten; the wrapper keeps the call sites themselves upstream's |
| no `log.*` calls | the logger was a no-op |
| no custom integrations | unreachable from the public API, and its win32 argv parser is unpublished on npm |
| no flag-disabled detection (WSL) | dead code; re-enabling one is a feature decision to raise, not a silent flip |
| no `parse` / `Default` / `findShellOrDefault` / `ShellError` | unreachable |
| plain error wording | upstream's strings tell the user to open Settings |

New upstream imports get inlined or dropped — never vendor the module graph behind
them, and check any new dependency is actually published.

```ts
export const Shell = {
  Terminal: 'Terminal',
  PowerShellCore: 'PowerShell Core',
} as const

export type Shell = (typeof Shell)[keyof typeof Shell]
```

## 3. Verify

```bash
npm run typecheck
npm test # compiles, then runs tests/*.test.mts on node:test
```

Only the current platform is covered. Re-read each port side by side against
upstream — that's what the matching shape is for. The `never` in each `default:`
catches a missing arm; nothing catches a typo'd registry key, so diff the sets of
paths, keys and flags out of both files if you want certainty. Roughly 75% of
upstream's non-blank lines should survive verbatim; materially less means something
got restructured.

## 4. Report

Update `src/shells/upstream.json`, then note the new and removed shells per
platform, public API changes with the semver bump that follows, and anything
deliberately dropped. Don't bump the version or commit as part of the sync.
