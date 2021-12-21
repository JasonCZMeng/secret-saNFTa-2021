/* eslint-disable no-underscore-dangle */

const { ethers } = require("hardhat");

const { expect } = require("chai");

const { expectRevert } = require("@openzeppelin/test-helpers");

const { shouldBehaveLikeERC721 } = require("./ERC721.behavior");

const createFactory = (contract) => async (owner) => {
  const NFT = await ethers.getContractFactory(contract, owner);
  return NFT.deploy();
};

const santaFactory = createFactory("SecretSaNFTa");
const nftFactory = createFactory("TestNFT");

shouldBehaveLikeERC721(
  "SecretSaNFTa",
  santaFactory,
  async () => ethers.getSigners(),
  async (santaContract, to) => {
    const [, , nftMinter] = await ethers.getSigners();
    const nftContract = await nftFactory(nftMinter);

    await nftContract.safeMint(to.address);
    const token = await nftContract._lastMintedId();

    await nftContract.connect(to).approve(santaContract.address, token);
    await santaContract
      .connect(to)
      .mintAfterApproval(nftContract.address, token);
  }
);

/* eslint-disable func-names */
context("SecretSaNFTa", function () {
  let santaMinter;
  let nftMinter;
  let acc1;
  let acc2;
  let santaContract;
  let nftContract;

  beforeEach(async function () {
    [santaMinter, nftMinter, acc1, acc2] = await ethers.getSigners();
    santaContract = await santaFactory(santaMinter);
    nftContract = await nftFactory(nftMinter);
  });

  const mint = async (acc) => {
    await nftContract.safeMint(acc.address);
    return nftContract._lastMintedId();
  };

  const approve = async (acc, id) =>
    nftContract.connect(acc).approve(santaContract.address, id);

  const donate = async (acc, id) => {
    await santaContract.connect(acc).mintAfterApproval(nftContract.address, id);
    return santaContract._lastMintedId();
  };

  const approveAndDonate = async (acc, id) => {
    await approve(acc, id);
    return donate(acc, id);
  };

  const mintAndDonate = async (acc) => {
    const toDonate = await mint(acc);
    const minted = await approveAndDonate(acc, toDonate);

    return [toDonate, minted];
  };

  const exchange = async (acc, id) =>
    santaContract.connect(acc).exchangeSanta(id);

  const ensure = async (func, mintOffset, exchangeOffset) => {
    const setOffsets = async (t, m, e) => {
      await santaContract._setMintingEnd(t + m);
      await santaContract._setExchangeEnd(t + e);
    };

    const currentTimestamp = (
      await ethers.provider.getBlock(await ethers.provider.getBlockNumber())
    ).timestamp;

    await setOffsets(currentTimestamp, mintOffset, exchangeOffset);
    const res = await func();
    await setOffsets(currentTimestamp, -mintOffset, -exchangeOffset);

    return res;
  };

  const ensureDonate = async (func) => ensure(func, 1000, 2000);

  const ensureExchange = async (func) => ensure(func, -1000, 1000);

  const expectFailedTxn = async (expectMsg, errMsg, func) => {
    it(expectMsg, async function () {
      await expectRevert(func(), errMsg);
    });

    it("should not change number of tokens in circulation", async function () {
      const numTokens = await santaContract._totalSupply();

      try {
        await func();
      } catch (err) {
        // We expect this to fail
      }

      expect(numTokens).to.equal(await santaContract._totalSupply());
    });
  };

  describe("Helper functions", function () {
    describe("lastMintedId", function () {
      context("when invoked by non-owner", function () {
        it("should deny the request", async function () {
          const otherContract = await santaContract.connect(acc1);

          await expectRevert(
            otherContract._lastMintedId(),
            "AccessControl: account"
          );
        });
      });

      context("and nothing has been minted", function () {
        it("should return 0", async function () {
          const lastMinted = await santaContract._lastMintedId();
          expect(lastMinted.toString()).to.be.bignumber.equal("0");
        });
      });

      context("and a token has already been minted", function () {
        it("should return the last minted ID", async function () {
          const lastMinted = await mint(acc1);
          expect(lastMinted.toString()).to.be.bignumber.equal("1");
        });
      });
    });

    describe("getDeposits", function () {
      context("when invoked by non-owner", function () {
        it("should deny requests from contracts", async function () {
          const otherContract = await santaContract.connect(acc1);

          await expectRevert(
            otherContract._getDeposits(),
            "AccessControl: account"
          );
        });
      });

      context("and nothing has been minted", function () {
        it("should return empty array", async function () {
          const deposits = await santaContract._getDeposits();
          expect(deposits.length).to.be.equal(0);
        });
      });

      context("and an nft has been minted", function () {
        it("should return array with deposits", async function () {
          const toDonate = await mint(acc1);
          await approveAndDonate(acc1, toDonate);

          const deposits = await santaContract._getDeposits();
          expect(deposits.length).to.be.equal(1);
        });
      });
    });

    describe("totalSupply", function () {
      context("when invoked by non-owner", function () {
        it("should deny requests from contracts", async function () {
          const otherContract = await santaContract.connect(acc1);

          await expectRevert(
            otherContract._totalSupply(),
            "AccessControl: account"
          );
        });
      });

      context("and nothing has been minted", function () {
        it("should return 0", async function () {
          const supply = await santaContract._totalSupply();
          expect(supply).to.be.equal(0);
        });
      });

      context("and NFTs have been minted and burned", function () {
        it("should increase when new tokens are minted", async function () {
          const originalSupply = await santaContract._totalSupply();
          await ensureDonate(async () => mintAndDonate(acc1));
          expect(await santaContract._totalSupply()).to.be.equal(
            Number(originalSupply) + 1
          );
        });

        it("should decrease when tokens are burned", async function () {
          const [, token] = await ensureDonate(async () => mintAndDonate(acc1));
          await ensureDonate(async () => mintAndDonate(acc2));

          const originalSupply = await santaContract._totalSupply();
          expect(originalSupply).to.be.equal(2);

          await ensureExchange(async () => exchange(acc1, token));
          expect(await santaContract._totalSupply()).to.be.equal(
            Number(originalSupply) - 1
          );
        });
      });

      describe("_setSupplyLimit", function () {
        context("when invoked by non-owner", function () {
          it("should deny requests from contracts", async function () {
            const otherContract = await santaContract.connect(acc1);

            await expectRevert(
              otherContract._setSupplyLimit(0),
              "AccessControl: account"
            );
          });
        });

        context("when invoked by owner", function () {
          beforeEach(async function () {
            await santaContract._setSupplyLimit(0);
          });

          /* eslint-disable mocha/no-setup-in-describe */
          expectFailedTxn(
            "should reject the donation",
            "Limit of SaNFTas reached",
            async () => {
              await ensureDonate(async () => mintAndDonate(acc1));
            }
          );
        });
      });
    });

    describe("changing time windows", function () {
      context("when invoked by non-owner", function () {
        it("should deny setMintingEnd requests", async function () {
          const otherContract = await santaContract.connect(acc1);

          await expectRevert(
            otherContract._setMintingEnd(1640476799),
            "AccessControl: account"
          );
        });

        it("should deny setExchangeEnd requests", async function () {
          const otherContract = await santaContract.connect(acc1);

          await expectRevert(
            otherContract._setExchangeEnd(1642476799),
            "AccessControl: account"
          );
        });
      });

      context("when invoked by owner", function () {
        specify("setMintingEnd should change the timestamp", async function () {
          const originalTstamp = await santaContract.mintingEnd();
          await santaContract._setMintingEnd(originalTstamp + 1000);
          expect(await santaContract.mintingEnd()).to.equal(
            originalTstamp + 1000
          );
        });

        specify(
          "setExchangeEnd should change the timestamp",
          async function () {
            const originalTstamp = await santaContract.exchangeEnd();
            await santaContract._setExchangeEnd(originalTstamp + 1000);
            expect(await santaContract.exchangeEnd()).to.equal(
              originalTstamp + 1000
            );
          }
        );
      });
    });

    describe("setTokenURIPrefix", function () {
      context("when invoked by non-owner", function () {
        it("should deny requests from contracts", async function () {
          const otherContract = await santaContract.connect(acc1);

          await expectRevert(
            otherContract._setTokenURIPrefix("foo"),
            "AccessControl: account"
          );
        });
      });

      context("when invoked correctly", function () {
        it("should set the token URI", async function () {
          await santaContract._setTokenURIPrefix("https://foobarbaz/");
          const [, minted] = await ensureDonate(async () =>
            mintAndDonate(acc1)
          );
          expect(await santaContract.tokenURI(minted)).to.equal(
            `https://foobarbaz/${minted}`
          );
        });
      });
    });
  });

  describe("Minting", function () {
    context("when not permissable", function () {
      describe("due to being after the deadline", function () {
        let lastMinted;
        let originalTstamp;
        beforeEach(async function () {
          lastMinted = await mint(acc1);
          await approve(acc1, lastMinted);

          originalTstamp = santaContract.mintingEnd();

          const currentTstamp = (
            await ethers.provider.getBlock(
              await ethers.provider.getBlockNumber()
            )
          ).timestamp;
          await santaContract._setMintingEnd(currentTstamp - 1000);
        });

        afterEach(async function () {
          await santaContract._setMintingEnd(originalTstamp);
        });

        /* eslint-disable mocha/no-setup-in-describe */
        expectFailedTxn(
          "should reject the donation",
          "Donation window is closed!",
          async () => donate(acc1, lastMinted)
        );
      });

      describe("due to the NFT being invalid", function () {
        /* eslint-disable mocha/no-setup-in-describe */
        expectFailedTxn(
          "should reject a non-nft address",
          "IS_NOT_721_TOKEN",
          async () =>
            santaContract.connect(acc1).mintAfterApproval(acc2.address, 0)
        );
      });

      describe("when Santa contract is not approved", function () {
        let lastMinted;
        beforeEach(async function () {
          lastMinted = await mint(acc1);
        });

        /* eslint-disable mocha/no-setup-in-describe */
        expectFailedTxn(
          "should reject a non-approved token",
          "ERC721: transfer caller is not owner nor approved",
          async () => donate(acc1, lastMinted)
        );
      });

      describe("when attempting to donate a Santa", function () {
        let mintedSanta;
        beforeEach(async function () {
          [, mintedSanta] = await mintAndDonate(acc1);

          await santaContract
            .connect(acc1)
            .approve(santaContract.address, mintedSanta);
        });

        /* eslint-disable mocha/no-setup-in-describe */
        expectFailedTxn(
          "should reject the donation",
          "Cannot donate a SaNFTa, silly!",
          async () =>
            santaContract
              .connect(acc1)
              .mintAfterApproval(santaContract.address, mintedSanta)
        );
      });

      describe("when exceeding the limit", function () {
        /* eslint-disable mocha/no-setup-in-describe */
        expectFailedTxn(
          "should reject the donation",
          "Limit of SaNFTas reached",
          async () => {
            santaContract._setSupplyLimit(0);
            await ensureDonate(async () => mintAndDonate(acc1));
          }
        );
      });
    });

    context("when permissable", function () {
      let toDonate;
      beforeEach(async function () {
        toDonate = await mint(acc1);
        await approve(acc1, toDonate);
      });

      describe("ownership of donated nft", function () {
        it("should be acc1 before minting", async function () {
          const tokenOwner = await nftContract.ownerOf(toDonate);
          expect(tokenOwner).to.equal(acc1.address);
        });

        it("should be the santa contract after minting", async function () {
          await donate(acc1, toDonate);
          const tokenOwner = await nftContract.ownerOf(toDonate);
          expect(tokenOwner).to.equal(santaContract.address);
        });
      });

      describe("minting of Santa nft", function () {
        it("should be owned by acc1", async function () {
          const donated = await donate(acc1, toDonate);
          const tokenOwner = await santaContract.ownerOf(donated);
          expect(tokenOwner).to.equal(acc1.address);
        });
      });
    });
  });

  describe("Exchanging", function () {
    context("when not permissable", function () {
      describe("due to being before the deadline", function () {
        let toExchange;
        let originalTstamp;
        beforeEach(async function () {
          [, toExchange] = await mintAndDonate(acc1);
          originalTstamp = await santaContract.mintingEnd();

          const currentTstamp = (
            await ethers.provider.getBlock(
              await ethers.provider.getBlockNumber()
            )
          ).timestamp;

          await santaContract._setMintingEnd(currentTstamp + 1000);
        });

        afterEach(async function () {
          await santaContract._setMintingEnd(originalTstamp);
        });

        expectFailedTxn(
          "should reject the exchange",
          "Exchange window is closed!",
          async () => exchange(acc1, toExchange)
        );
      });

      describe("due to being after the deadline", function () {
        let toExchange;
        let originalTstamp;
        beforeEach(async function () {
          [, toExchange] = await mintAndDonate(acc1);
          originalTstamp = await santaContract.mintingEnd();

          const currentTstamp = (
            await ethers.provider.getBlock(
              await ethers.provider.getBlockNumber()
            )
          ).timestamp;
          await santaContract._setExchangeEnd(currentTstamp - 1000);
        });

        afterEach(async function () {
          await santaContract._setExchangeEnd(originalTstamp);
        });

        expectFailedTxn(
          "should reject the exchange",
          "Exchange window is closed!",
          async () => exchange(acc1, toExchange)
        );
      });

      describe("due to the NFT being invalid", function () {
        beforeEach(async function () {
          const currentTstamp = (
            await ethers.provider.getBlock(
              await ethers.provider.getBlockNumber()
            )
          ).timestamp;

          await santaContract._setMintingEnd(currentTstamp - 1000);
        });

        expectFailedTxn(
          "should reject a non-existent token",
          "ERC721: operator query for nonexistent token",
          async () => exchange(acc1, 0)
        );
      });

      describe("because sender is not owner", function () {
        let donated;
        beforeEach(async function () {
          [, donated] = await ensureDonate(() => mintAndDonate(acc1));
        });

        expectFailedTxn(
          "should reject if token isn't sender's",
          "Not owner/approved for this NFT",
          async () => ensureExchange(() => exchange(acc2, donated))
        );
      });
    });

    context("when permissable", function () {
      let donated;
      let toExchange;
      beforeEach(async function () {
        [donated, toExchange] = await ensureDonate(() => mintAndDonate(acc1));
      });

      describe("ownership", function () {
        context("preconditions", function () {
          specify(
            "Santa should own donated before exchanging",
            async function () {
              const tokenOwner = await nftContract.ownerOf(donated);
              expect(tokenOwner).to.equal(santaContract.address);
            }
          );

          specify(
            "donator should own Santa token before exchanging",
            async function () {
              const tokenOwner = await santaContract.ownerOf(toExchange);
              expect(tokenOwner).to.equal(acc1.address);
            }
          );
        });

        context("and there's only one NFT", function () {
          specify(
            "donator should own exchanged NFT after exchanging",
            async function () {
              await ensureExchange(() => exchange(acc1, toExchange));
              const tokenOwner = await nftContract.ownerOf(donated);
              expect(tokenOwner).to.equal(acc1.address);
            }
          );
        });

        context("and there are two NFTs", function () {
          let donated2;
          let toExchange2;
          beforeEach(async function () {
            [donated2, toExchange2] = await ensureDonate(() =>
              mintAndDonate(acc2)
            );
          });

          context("preconditions", function () {
            specify(
              "Santa should own donated2 before exchanging",
              async function () {
                const tokenOwner = await nftContract.ownerOf(donated2);
                expect(tokenOwner).to.equal(santaContract.address);
              }
            );

            specify(
              "donator2 should own Santa token before exchanging",
              async function () {
                const tokenOwner = await santaContract.ownerOf(toExchange2);
                expect(tokenOwner).to.equal(acc2.address);
              }
            );
          });

          describe("when first donator redeems first", function () {
            specify(
              "first donator should get second donator's NFT",
              async function () {
                await ensureExchange(() => exchange(acc1, toExchange));
                const tokenOwner = await nftContract.ownerOf(donated2);
                expect(tokenOwner).to.equal(acc1.address);
              }
            );

            specify(
              "then second donator should get first donator's NFT",
              async function () {
                await ensureExchange(() => exchange(acc1, toExchange));
                await ensureExchange(() => exchange(acc2, toExchange2));

                const tokenOwner = await nftContract.ownerOf(donated);
                expect(tokenOwner).to.equal(acc2.address);
              }
            );
          });

          describe("when second donator redeems first", function () {
            specify(
              "second donator should get first donator's NFT",
              async function () {
                await ensureExchange(() => exchange(acc2, toExchange2));
                const tokenOwner = await nftContract.ownerOf(donated);
                expect(tokenOwner).to.equal(acc2.address);
              }
            );

            specify(
              "then first donator should get second donator's NFT",
              async function () {
                await ensureExchange(() => exchange(acc2, toExchange2));
                await ensureExchange(() => exchange(acc1, toExchange));

                const tokenOwner = await nftContract.ownerOf(donated2);
                expect(tokenOwner).to.equal(acc1.address);
              }
            );
          });
        });
      });
    });
  });
});
