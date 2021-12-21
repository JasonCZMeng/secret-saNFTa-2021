// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";

/**
 * @dev Contract that operates a Secret Santa gift exchange with NFTs.
 *
 * The Secret Santa has two phases. In the first phase, participants may
 * donate an NFT to the contract, which then automatically mints and transfers
 * a SecretSaNFTa NFT back to the donor. This happens atomically and is a fully-
 * decentralized operation.
 *
 * After a configurable timestamp (mintingEnd), the first phase ends and minting
 * of new SecretSaNFTas is disabled.
 *
 * In the second phase, anyone holding a SecretSaNFTa can exchange their
 * SecretSaNFTa and receive a random donated NFT in return. When a SecretSaNFTa
 * is turned in, it's burned permanently. After a configurable timestamp
 * (exchangeEnd), the second phase ends and the ability to exchange is disabled.
 * Anyone who didn't turn in their SecretSaNFTa gets to keep it permanently.
 *
 * At the end of the second phase, all outstanding NFTs—if any—stay in this
 * contract. As of this version, that's where the story ends—but the spirit of
 * the Secret SaNFTa exchange is one of charity. The idea is that the Secret
 * SaNFTas oustanding after the exchange period would entitle the holder to
 * membership in a DAO. These members would be empowered to auction off the
 * remaining donated NFTs and donate the proceeds to charity. Each SecretSaNFTa
 * represents one vote in the DAO.
 */
contract SecretSaNFTa is
    ERC721,
    IERC721Receiver,
    AccessControl,
    ReentrancyGuard
{
    using Counters for Counters.Counter;
    using ERC165Checker for address;

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    uint64 public mintingEnd = 1640494799; // End of Dec. 25 2021 EST
    uint64 public exchangeEnd = 1641099599; // End of Jan. 1 2022 EST

    bytes4 private constant INTERFACE_ID_ERC721 = 0x80ac58cd;

    Counters.Counter private _tokenIdCounter;
    Counters.Counter private _totalSupplyCounter;

    DepositedNFT[] private _deposits;

    string private _tokenURIPrefix;
    uint256 private _supplyLimit = 10000;

    constructor() ERC721("SecretSaNFTa 2021", "SNFT2021") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);

        _tokenURIPrefix = "https://d2ojzbuze38ajw.cloudfront.net/collections/secret-sanfta-2021/";
    }

    function mintAfterApproval(address contractAddr, uint256 tokenId)
        external
        nonReentrant
    {
        require(
            contractAddr != address(this),
            "Cannot donate a SaNFTa, silly!"
        );

        require(
            // Should write a unit test to ensure this works if totalSupply
            // is different from the token ID
            _totalSupplyCounter.current() < _supplyLimit,
            "Limit of SaNFTas reached"
        );

        require(
            // solhint-disable-next-line not-rely-on-time
            block.timestamp < mintingEnd,
            "Donation window is closed!"
        );

        require(
            contractAddr.supportsInterface(INTERFACE_ID_ERC721),
            "IS_NOT_721_TOKEN"
        );

        IERC721 nft = IERC721(contractAddr);
        _transferThenMint(nft, tokenId, msg.sender);
    }

    function exchangeSanta(uint256 santaTokenId) external nonReentrant {
        require(
            // solhint-disable-next-line not-rely-on-time
            block.timestamp > mintingEnd &&
                // solhint-disable-next-line not-rely-on-time
                block.timestamp < exchangeEnd,
            "Exchange window is closed!"
        );

        require(
            _isApprovedOrOwner(msg.sender, santaTokenId),
            "Not owner/approved for this NFT"
        );

        uint256 idx = _chooseForRedemption(msg.sender, santaTokenId);
        DepositedNFT memory toReceive = _deposits[idx];

        _deposits[idx] = _deposits[_deposits.length - 1];
        _deposits.pop();

        _burn(santaTokenId);

        toReceive.contractAddr.transferFrom(
            address(this),
            msg.sender,
            toReceive.tokenId
        );
    }

    function _lastMintedId()
        public
        view
        onlyRole(MANAGER_ROLE)
        returns (uint256)
    {
        return _tokenIdCounter.current();
    }

    function _setMintingEnd(uint64 tstamp) external onlyRole(MANAGER_ROLE) {
        mintingEnd = tstamp;
    }

    function _setExchangeEnd(uint64 tstamp) external onlyRole(MANAGER_ROLE) {
        exchangeEnd = tstamp;
    }

    function _setTokenURIPrefix(string calldata prefix)
        external
        onlyRole(MANAGER_ROLE)
    {
        _tokenURIPrefix = prefix;
    }

    function _getDeposits()
        external
        view
        onlyRole(MANAGER_ROLE)
        returns (DepositedNFT[] memory)
    {
        return _deposits;
    }

    function _totalSupply()
        external
        view
        onlyRole(MANAGER_ROLE)
        returns (uint256)
    {
        return _totalSupplyCounter.current();
    }

    function _setSupplyLimit(uint256 supplyLimit)
        external
        onlyRole(MANAGER_ROLE)
    {
        _supplyLimit = supplyLimit;
    }

    // The following functions are overrides required by Solidity.

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) public virtual override returns (bytes4) {
        return this.onERC721Received.selector;
    }

    function _transferThenMint(
        IERC721 nft,
        uint256 tokenId,
        address sender
    ) private {
        _tokenIdCounter.increment();
        uint256 santaId = _tokenIdCounter.current();

        DepositedNFT memory minted = DepositedNFT(
            nft,
            tokenId,
            sender,
            santaId
        );
        _deposits.push(minted);

        _safeMint(sender, santaId);
        nft.safeTransferFrom(sender, address(this), tokenId);

        assert(nft.ownerOf(tokenId) == address(this));
    }

    function _chooseForRedemption(address sender, uint256 santaTokenId)
        private
        view
        returns (uint256)
    {
        assert(_deposits.length > 0);

        uint256 redemptionHash = uint256(
            keccak256(
                abi.encodePacked(
                    blockhash(block.number - 1),
                    // solhint-disable-next-line not-rely-on-time
                    block.timestamp,
                    santaTokenId,
                    _deposits.length
                )
            )
        );

        uint256 idx = redemptionHash % _deposits.length;
        uint256 i = 0;
        while (i < 3 && _deposits[idx].donatorAddr == sender) {
            i++;
            idx = (idx + 1) % _deposits.length;
        }

        assert(idx < _deposits.length);
        return idx;
    }

    function _baseURI() internal view override returns (string memory) {
        return _tokenURIPrefix;
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual override {
        if (from == address(0)) {
            _totalSupplyCounter.increment();
        } else if (to == address(0)) {
            _totalSupplyCounter.decrement();
        }
        super._beforeTokenTransfer(from, to, tokenId);
    }
}

struct DepositedNFT {
    IERC721 contractAddr;
    uint256 tokenId;
    address donatorAddr;
    uint256 santaTokenId;
}
