module.exports = {
  // TypeScript and JavaScript files
  '**/*.{ts,tsx,js,jsx}': [
    'eslint --fix --max-warnings=0',
    'prettier --write',
    () => 'tsc --noEmit', // Type check all files
  ],

  // JSON, YAML, Markdown files
  '**/*.{json,yml,yaml,md}': ['prettier --write'],

  // Package.json specific
  '**/package.json': ['prettier --write', 'npm run sort-package-json || true'],

  // Environment files - security check
  '**/.env*': [
    (filenames) => {
      const envFiles = filenames.filter((f) => !f.endsWith('.example'));
      if (envFiles.length > 0) {
        throw new Error(
          `ERROR: Attempting to commit .env files:\n${envFiles.join('\n')}\n\nAdd them to .gitignore!`
        );
      }
      return [];
    },
  ],
};
