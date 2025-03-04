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
      filePath: './dist/streamix/coroutine/index.d.ts',
      outFile: './dist/streamix/coroutine/@actioncrew/index.d.ts',
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
