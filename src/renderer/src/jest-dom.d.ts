// Wires @testing-library/jest-dom's matcher type augmentation into the web
// TypeScript program. vitest.setup.ts imports this at runtime, but it lives at
// the repo root and is outside tsconfig.web.json's include, so `tsc` would not
// otherwise see the augmented `Assertion` matchers (toBeInTheDocument, etc.).
import '@testing-library/jest-dom/vitest'
