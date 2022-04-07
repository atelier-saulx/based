module.exports = {
  parser: "@typescript-eslint/parser",

  plugins: ["@typescript-eslint", "prettier"],

  extends: [
    "standard",
    "standard-jsx",
    "standard-react",
    "prettier",
    "plugin:@typescript-eslint/eslint-recommended",
  ],

  rules: {
    "@typescript-eslint/no-unused-vars": "error",
    "no-alert": 1,
    "no-console": [1, { allow: ["info", "warn", "error", "time", "timeEnd"] }],
    "no-debugger": 1,
    "no-use-before-define": 0,
    "prettier/prettier": "error",
    "react/jsx-curly-newline": 0,
    "react/jsx-handler-names": 0,
    "react/prop-types": 0,
  },
};
