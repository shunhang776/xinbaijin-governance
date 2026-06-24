export default {
  testRunner: "vitest",
  mutate: [
    "src/readback-integrity.mjs",
    "src/build-gate-input.mjs"
  ],
  mutator: {
    excludedMutations: ["StringLiteral"]
  },
  reporters: ["clear-text", "progress", "html"],
  coverageAnalysis: "perTest",
  thresholds: {
    high: 90,
    low: 80,
    break: 80
  },
  tempDirName: ".stryker-tmp"
};
