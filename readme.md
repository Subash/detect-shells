### Detect Shells

Extracted from https://github.com/desktop/desktop/tree/development/app/src/lib/shells

```javascript
import path from 'node:path';
import { getAvailableShells, launchShell } from 'detect-shells';

const shells = await getAvailableShells();
await launchShell(shells[0], process.cwd());
```

`src/shells` is a port of the upstream code at the commit recorded in
`src/shells/upstream.json`. See [UPDATING.md](UPDATING.md) to re-sync it.

License -> https://github.com/desktop/desktop/blob/development/LICENSE
