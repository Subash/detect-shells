* Copy everything from `https://github.com/desktop/desktop/tree/development/app/src/lib/shells` to `./shells`
* Current files are at commit `7c1db3e75e5a3497eaa2b3b16b32ca1e491c2710`
* Find and replace `__DARWIN__` with `process.platform === 'darwin'`
* Find and replace `__WIN32__` with `process.platform === 'win32'`
* Find and replace `__LINUX__` with `process.platform === 'linux'`
* Add `import log from '../log'` at the top of `shared.ts`, `win32.ts` and `is-git-on-path.ts`. ie, all the files using `log.*` methods
