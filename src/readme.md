* Copy everything from `https://github.com/desktop/desktop/tree/development/app/src/lib/shells` to `./shells`
* Current files are at commit `bd0901c9b5cafc0974750126f421d03157358739`
* Find and replace `__DARWIN__` with `process.platform === 'darwin'`
* Find and replace `__WIN32__` with `process.platform === 'win32'`
* Find and replace `__LINUX__` with `process.platform === 'linux'`
* Add `import log from '../log'` at the top of `shared.ts` and `win32.ts`. ie, all the files using `log.*` methods
