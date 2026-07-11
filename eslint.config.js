import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

/**
 * Flat ESLint config for the React + Vite frontend. Kept close to the recommended sets
 * so it complements (does not fight) the strict `tsc --noEmit` gate the build already
 * runs. The `react-hooks` plugin makes deliberate hook-dep suppressions explicit.
 */
export default tseslint.config(
  { ignores: ['dist', 'mcp', 'docs', 'node_modules', '.vercel'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
)
