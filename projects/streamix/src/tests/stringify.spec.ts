import { parse, stringify } from '../lib';

describe('Massive data structure with stringify and parse', () => {
  it('should handle massive data structures efficiently with stringify', (done) => {
    // Create a massive object with 10 million items
    const largeData: any = {};
    for (let i = 0; i < 10e3; i++) {
      largeData[`key${i}`] = `value${i}`;
    }

    // Use the stringify operator to serialize the massive data structure
    stringify(largeData).subscribe((value) => {
      expect(value).toBe(JSON.stringify(largeData)); // Check if the result matches the stringified version
      done();
    });

    it('should handle parsing of large JSON string', (done) => {
      // Create a massive JSON string representing a large data structure
      const largeJson = JSON.stringify({ key: Array(10e3).fill('value') });

      // Use the parse operator to deserialize the massive JSON string
      parse(largeJson).subscribe((value) => {
        expect(value).toEqual({ key: Array(10e6).fill('value') }); // Check if the parsed result matches
        done();
      });
    });

    it('should handle chunking of massive data efficiently', (done) => {
      // Large data chunking simulation
      const chunkedData = Array(1000)
        .fill(undefined)
        .map((_, i) => ({
          chunk: i,
          data: Array(1000).fill(`chunk-data-${i}`),
        }));

      // Assume stringify can handle chunking logic
      chunkedData.forEach((chunk, index) => {
        stringify(chunk).subscribe((result) => {
          expect(result).toBe(JSON.stringify(chunk));
          if (index === chunkedData.length - 1) done();
        });
      });
    });
  });
});
