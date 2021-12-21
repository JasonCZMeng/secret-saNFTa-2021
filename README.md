# Secret SaNFTa Smart Contracts
A decentralized Secret Santa gift exchange, with NFTs.
The Secret Santa has two phases. In the first phase, participants may
donate an NFT to the contract, which then automatically mints and transfers
a SecretSaNFTa NFT back to the donor. This happens atomically and is a fully-
decentralized operation.

After a configurable timestamp (mintingEnd), the first phase ends and minting
of new SecretSaNFTas is disabled.

In the second phase, anyone holding a SecretSaNFTa can exchange their
SecretSaNFTa and receive a random donated NFT in return. When a SecretSaNFTa
is turned in, it's burned permanently. After a configurable timestamp
(exchangeEnd), the second phase ends and the ability to exchange is disabled.
Anyone who didn't turn in their SecretSaNFTa gets to keep it permanently.

At the end of the second phase, all outstanding NFTs—if any—stay in this
contract. As of this version, that's where the story ends—but the spirit of
the Secret SaNFTa exchange is one of charity. The idea is that the Secret
SaNFTas outstanding after the exchange period would entitle the holder to
membership in a DAO. These members would be empowered to auction off the
remaining donated NFTs and donate the proceeds to charity. Each SecretSaNFTa
entitles the holder to one vote in the DAO.
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
