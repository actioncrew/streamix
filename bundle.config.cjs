module.exports = {
  entries: [
    {
      filePath: './dist/streamix/index.d.ts',
      outFile: './dist/streamix/@actioncrew/index.d.ts',
      output: {
        inlineDeclareGlobals: false,
        noBanner: true,
      },
    },
    {
      filePath: './dist/streamix/http/index.d.ts',
      outFile: './dist/streamix/http/@actioncrew/index.d.ts',
      output: {
        inlineDeclareGlobals: false,
        noBanner: true,
      },
      libraries: {
        importedLibraries: ['@actioncrew/streamix'],
        inlinedLibraries: [],
      }
    },
    {
      filePath: './dist/streamix/coroutine/async/index.d.ts',
      outFile: './dist/streamix/coroutine/async/@actioncrew/index.d.ts',
      output: {
        inlineDeclareGlobals: false,
        noBanner: true,
      }
    },
  ],
  compilationOptions: {
    preferredConfigPath: './tsconfig.json'
  }
};
