module.exports = {
  // Line width
  printWidth: 100,

  // Indentation
  tabWidth: 2,
  useTabs: false,

  // Quotes
  singleQuote: true,
  quoteProps: 'as-needed',

  // Semicolons
  semi: true,

  // Trailing commas
  trailingComma: 'es5',

  // Brackets
  bracketSpacing: true,
  bracketSameLine: false,

  // Arrows
  arrowParens: 'always',

  // Line endings
  endOfLine: 'lf',

  // JSX
  jsxSingleQuote: false,

  // Overrides for specific file types
  overrides: [
    {
      files: '*.json',
      options: {
        printWidth: 80,
        tabWidth: 2,
      },
    },
    {
      files: '*.md',
      options: {
        printWidth: 80,
        proseWrap: 'always',
      },
    },
    {
      files: '*.yml',
      options: {
        tabWidth: 2,
        singleQuote: false,
      },
    },
  ],
};
