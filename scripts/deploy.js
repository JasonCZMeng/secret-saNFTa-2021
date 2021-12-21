async function main () {
    if (!process.argv.includes('--production')) {
      const TestNFT = await ethers.getContractFactory('TestNFT');
      console.log('Deploying TestNFT...');

      const tnft = await TestNFT.deploy();
      await tnft.deployed();
      console.log('TestNFT deployed to:', tnft.address);
    }

    const SecretSaNFTa = await ethers.getContractFactory('SecretSaNFTa');
    console.log('Deploying SecretSaNFTa...');

    const ssa = await SecretSaNFTa.deploy();
    await ssa.deployed();
    console.log('SecretSaNFTa deployed to:', ssa.address);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
