/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts"],
  clearMocks: true,
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.test.json" }]
  },
  // cli.ts is exercised by __tests__/cli.test.ts, but as a child process, so
  // Jest's coverage instrumentation never sees it; excluding it keeps the
  // threshold meaningful for the in-process library code.
  collectCoverageFrom: ["src/**/*.ts", "!src/styles.ts", "!src/index.ts", "!src/cli.ts"],
  coverageThreshold: {
    global: {
      statements: 82,
      branches: 70,
      functions: 85,
      lines: 84
    }
  }
};
