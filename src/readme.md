* Copy everything from `https://github.com/desktop/desktop/tree/development/app/src/lib/shells` to `./shells`
* Current files are at commit `1444a78057d964989c686974af8e4d65439f5a36`
* Find and replace `__DARWIN__` with `process.platform === 'darwin'`
* Find and replace `__WIN32__` with `process.platform === 'win32'`
* Find and replace `__LINUX__` with `process.platform === 'linux'`
* Add `import log from '../log'` at the top of `shared.ts`, `win32.ts` and `is-git-on-path.ts`. ie, all the files using `log.*` methods
