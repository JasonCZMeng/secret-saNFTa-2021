# Secret SaNFTa Smart Contracts
### Setup
To begin development, clone this repo and run `npm install .`
### Tests
You can run the automated contract tests with `npx hardhat test` or `npm run test`.
### Linting
This project incorporates:
- [solhint](https://github.com/protofire/solhint) for linting Solidity source files
- [eslint](https://eslint.org) for linting JavaScript source files
- [prettier](https://prettier.io) for automated formatting of both JavaScript
and Solidity source files
- [slither](https://github.com/crytic/slither) for static security analysis
of the project's smart contracts.

Note that `slither` needs to be installed separately (see instructions in the
linked repo), while the other linters/formatters are managed as dev dependencies
with `npm`.

### Structure
Super simple—two contracts in `contracts/` (the actual Secret SaNFTa contract and
a utility contract for dev/testing), and a suite of tests in `test/`.
