// Test helper: lets Node run the app's TypeScript sources directly.
// The app imports modules without an extension (bundler style: '../sim', './constants');
// Node needs the real file, so a failed relative import is retried as <name>.ts, <name>.tsx
// and <name>/index.ts. Import this file first in a test, then load the sources with import().
import { registerHooks } from 'node:module'

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context)
    } catch (error) {
      if (!specifier.startsWith('.')) throw error
      for (const suffix of ['.ts', '.tsx', '/index.ts']) {
        try {
          return nextResolve(specifier + suffix, context)
        } catch {
          // try the next suffix
        }
      }
      throw error
    }
  },
})
