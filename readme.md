### Detect Shells

Extracted from https://github.com/desktop/desktop/tree/development/app/src/lib/shells

```javascript
import path from 'node:path';
import { getAvailableShells, launchShell } from 'detect-shells';

const shells = await getAvailableShells();
await launchShell(shells[0], process.cwd());
```

License -> https://github.com/desktop/desktop/blob/development/LICENSE
