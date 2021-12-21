module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2021: true,
  },
  extends: [
    'airbnb-base',
    'prettier',
    'plugin:mocha/recommended',
  ],
  parserOptions: {
    ecmaVersion: 13,
  },
  rules: {
    'prefer-arrow-callback': 0,
    'mocha/prefer-arrow-callback': 2
  },
  plugins: [
    "mocha",
  ],
};
