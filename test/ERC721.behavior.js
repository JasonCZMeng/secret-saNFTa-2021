const { constants, expectRevert } = require("@openzeppelin/test-helpers");

const { expect } = require("chai");

const { ZERO_ADDRESS } = constants;

function shouldBehaveLikeERC721(
  errorPrefix,
  contractFactory,
  accountFactory,
  mintNft
) {
  /* eslint-disable func-names */
  context("with minted nfts", function () {
    let owner;
    let other;
    let contract;

    before(async function () {
      [owner, other] = await accountFactory();

      contract = await contractFactory(owner);

      await mintNft(contract, owner);
      await mintNft(contract, owner);
    });

    describe("balanceOf", function () {
      context("when the given address owns some nfts", function () {
        it("returns the amount of nfts owned by the given address", async function () {
          const balance = await contract.balanceOf(owner.address);
          expect(balance.toString()).to.be.bignumber.equal("2");
        });

        context("when the given address does not own any nfts", function () {
          it("returns 0", async function () {
            expect(
              (await contract.balanceOf(other.address)).toString()
            ).to.be.bignumber.equal("0");
          });
        });

        context("when querying the zero address", function () {
          it("throws", async function () {
            await expectRevert(
              contract.balanceOf(ZERO_ADDRESS),
              "ERC721: balance query for the zero address"
            );
          });
        });
      });
    });

    describe("ownerOf", function () {
      context("when the given nft ID was tracked by this nft", function () {
        it("returns the owner of the given nft ID", async function () {
          expect(await contract.ownerOf(1)).to.be.equal(owner.address);
        });
      });

      context("when the given nft ID was not tracked by this nft", function () {
        it("reverts", async function () {
          await expectRevert(
            contract.ownerOf(3),
            "ERC721: owner query for nonexistent token"
          );
        });
      });
    });
  });
}

/* eslint-disable mocha/no-exports */
module.exports = {
  shouldBehaveLikeERC721,
};
