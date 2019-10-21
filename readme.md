### Detect Shells
Extracted manually from https://github.com/desktop/desktop/tree/development/app/src/lib/shells

```javascript
const detectShells = require('detect-shells');
detectShells
  .getAvailableShells()
  .then((shells)=> {
    console.log(shells);
  })
  .catch((err)=> console.log(err));
});
```

License -> https://github.com/desktop/desktop/blob/development/LICENSE
