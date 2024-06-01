import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { DeftPair, ERC20 } from "../../typechain-types";
import { MINIMUM_LIQUIDITY } from "./shared/constants";
import { expandTo18Decimals, encodePrice } from "./shared/utilities";

describe("DeftPair", () => {
  async function fixture() {
    const [wallet, other] = await ethers.getSigners();

    const [ERC20_MOCK, DEFT_PAIR_MOCK, DEFT_FACTORY_MOCK] = await Promise.all([
      ethers.getContractFactory("ERC20"),
      ethers.getContractFactory("DeftPair"),
      ethers.getContractFactory("DeftFactory"),
    ]);

    const [tokenA, tokenB, deftFactory] = await Promise.all([
      ERC20_MOCK.deploy(expandTo18Decimals(10000)),
      ERC20_MOCK.deploy(expandTo18Decimals(10000)),
      DEFT_FACTORY_MOCK.deploy(wallet.address),
    ]);

    const [tokenAaddress, tokenBaddress] = await Promise.all([
      tokenA.getAddress(),
      tokenB.getAddress(),
    ]);

    await deftFactory.createPair(tokenAaddress, tokenBaddress);

    const deftPair = DEFT_PAIR_MOCK.attach(
      await deftFactory.getPair(tokenAaddress, tokenBaddress),
    ) as DeftPair;

    const token0Address = await deftPair.token0();

    const token0 = tokenAaddress === token0Address ? tokenA : tokenB;
    const token1 = tokenAaddress === token0Address ? tokenB : tokenA;

    return { wallet, other, token0, token1, deftFactory, deftPair };
  }

  it("mint", async () => {
    const token0Amount = expandTo18Decimals(1);
    const token1Amount = expandTo18Decimals(4);
    const expectedLiquidity = expandTo18Decimals(2);

    const { wallet, token0, token1, deftPair } = await loadFixture(fixture);

    await token0.transfer(await deftPair.getAddress(), token0Amount);
    await token1.transfer(await deftPair.getAddress(), token1Amount);

    await expect(deftPair.mint(wallet.address))
      .to.emit(deftPair, "Transfer")
      .withArgs(ethers.ZeroAddress, ethers.ZeroAddress, MINIMUM_LIQUIDITY)
      .to.emit(deftPair, "Transfer")
      .withArgs(
        ethers.ZeroAddress,
        wallet.address,
        expectedLiquidity - MINIMUM_LIQUIDITY,
      )
      .to.emit(deftPair, "Sync")
      .withArgs(token0Amount, token1Amount)
      .to.emit(deftPair, "Mint")
      .withArgs(wallet.address, token0Amount, token1Amount);

    expect(await deftPair.totalSupply()).to.eq(expectedLiquidity);

    expect(await deftPair.balanceOf(wallet.address)).to.eq(
      expectedLiquidity - MINIMUM_LIQUIDITY,
    );

    expect(await token0.balanceOf(await deftPair.getAddress())).to.eq(
      token0Amount,
    );
    expect(await token1.balanceOf(await deftPair.getAddress())).to.eq(
      token1Amount,
    );

    const deftPairReserves = await deftPair.getReserves();

    expect(deftPairReserves[0]).to.eq(token0Amount);
    expect(deftPairReserves[1]).to.eq(token1Amount);
  });

  async function addLiquidity(
    token0: ERC20,
    token1: ERC20,
    deftPair: DeftPair,
    wallet: Signer,
    token0Amount: bigint,
    token1Amount: bigint,
  ) {
    const deftPairAddress = await deftPair.getAddress();

    await token0.transfer(deftPairAddress, token0Amount);
    await token1.transfer(deftPairAddress, token1Amount);

    await deftPair.mint(await wallet.getAddress());
  }

  const swapTestCases: bigint[][] = [
    [1, 5, 10, "1662497915624478906"],
    [1, 10, 5, "453305446940074565"],
    [2, 5, 10, "2851015155847869602"],
    [2, 10, 5, "831248957812239453"],
    [1, 10, 10, "906610893880149131"],
    [1, 100, 100, "987158034397061298"],
    [1, 1000, 1000, "996006981039903216"],
  ].map((a) =>
    a.map((n) => (typeof n === "string" ? BigInt(n) : expandTo18Decimals(n))),
  );

  swapTestCases.forEach((swapTestCase, i) => {
    it(`getInputPrice:${i}`, async () => {
      const [swapAmount, token0Amount, token1Amount, expectedOutputAmount] =
        swapTestCase;

      const { wallet, token0, token1, deftPair } = await loadFixture(fixture);

      await addLiquidity(
        token0,
        token1,
        deftPair,
        wallet,
        token0Amount,
        token1Amount,
      );

      await token0.transfer(await deftPair.getAddress(), swapAmount);

      await expect(
        deftPair.swap(0, expectedOutputAmount + 1n, wallet.address, "0x"),
      ).to.be.revertedWith("DeftPair: K");

      await deftPair.swap(0, expectedOutputAmount, wallet.address, "0x");
    });
  });

  const optimisticTestCases: bigint[][] = [
    ["997000000000000000", 5, 10, 1], // given amountIn, amountOut = floor(amountIn * .997)
    ["997000000000000000", 10, 5, 1],
    ["997000000000000000", 5, 5, 1],
    [1, 5, 5, "1003009027081243732"], // given amountOut, amountIn = ceiling(amountOut / .997)
  ].map((a) =>
    a.map((n) => (typeof n === "string" ? BigInt(n) : expandTo18Decimals(n))),
  );

  optimisticTestCases.forEach((optimisticTestCase, i) => {
    it(`optimistic:${i}`, async () => {
      const [outputAmount, token0Amount, token1Amount, inputAmount] =
        optimisticTestCase;

      const { wallet, token0, token1, deftPair } = await loadFixture(fixture);

      await addLiquidity(
        token0,
        token1,
        deftPair,
        wallet,
        token0Amount,
        token1Amount,
      );

      await token0.transfer(await deftPair.getAddress(), inputAmount);

      await expect(
        deftPair.swap(outputAmount + 1n, 0n, wallet.address, "0x"),
      ).to.be.revertedWith("DeftPair: K");

      await deftPair.swap(outputAmount, 0, wallet.address, "0x");
    });
  });

  it("swap:token0", async () => {
    const token0Amount = expandTo18Decimals(5);
    const token1Amount = expandTo18Decimals(10);
    const swapAmount = expandTo18Decimals(1);
    const expectedOutputAmount = 1662497915624478906n;

    const { wallet, token0, token1, deftPair } = await loadFixture(fixture);

    await addLiquidity(
      token0,
      token1,
      deftPair,
      wallet,
      token0Amount,
      token1Amount,
    );

    await token0.transfer(await deftPair.getAddress(), swapAmount);

    await expect(deftPair.swap(0, expectedOutputAmount, wallet.address, "0x"))
      .to.emit(token1, "Transfer")
      .withArgs(
        await deftPair.getAddress(),
        wallet.address,
        expectedOutputAmount,
      )
      .to.emit(deftPair, "Sync")
      .withArgs(token0Amount + swapAmount, token1Amount - expectedOutputAmount)
      .to.emit(deftPair, "Swap")
      .withArgs(
        wallet.address,
        swapAmount,
        0,
        0,
        expectedOutputAmount,
        wallet.address,
      );

    const deftPairReserves = await deftPair.getReserves();

    expect(deftPairReserves[0]).to.eq(token0Amount + swapAmount);
    expect(deftPairReserves[1]).to.eq(token1Amount - expectedOutputAmount);

    expect(await token0.balanceOf(await deftPair.getAddress())).to.eq(
      token0Amount + swapAmount,
    );
    expect(await token1.balanceOf(await deftPair.getAddress())).to.eq(
      token1Amount - expectedOutputAmount,
    );

    const totalSupplyToken0 = await token0.totalSupply();
    const totalSupplyToken1 = await token1.totalSupply();

    expect(await token0.balanceOf(wallet.address)).to.eq(
      totalSupplyToken0 - token0Amount - swapAmount,
    );
    expect(await token1.balanceOf(wallet.address)).to.eq(
      totalSupplyToken1 - token1Amount + expectedOutputAmount,
    );
  });

  it("swap:token1", async () => {
    const token0Amount = expandTo18Decimals(5);
    const token1Amount = expandTo18Decimals(10);
    const swapAmount = expandTo18Decimals(1);
    const expectedOutputAmount = 453305446940074565n;

    const { wallet, token0, token1, deftPair } = await loadFixture(fixture);

    await addLiquidity(
      token0,
      token1,
      deftPair,
      wallet,
      token0Amount,
      token1Amount,
    );

    await token1.transfer(await deftPair.getAddress(), swapAmount);

    await expect(deftPair.swap(expectedOutputAmount, 0, wallet.address, "0x"))
      .to.emit(token0, "Transfer")
      .withArgs(
        await deftPair.getAddress(),
        wallet.address,
        expectedOutputAmount,
      )
      .to.emit(deftPair, "Sync")
      .withArgs(token0Amount - expectedOutputAmount, token1Amount + swapAmount)
      .to.emit(deftPair, "Swap")
      .withArgs(
        wallet.address,
        0,
        swapAmount,
        expectedOutputAmount,
        0,
        wallet.address,
      );

    const deftPairReserves = await deftPair.getReserves();

    expect(deftPairReserves[0]).to.eq(token0Amount - expectedOutputAmount);
    expect(deftPairReserves[1]).to.eq(token1Amount + swapAmount);

    expect(await token0.balanceOf(await deftPair.getAddress())).to.eq(
      token0Amount - expectedOutputAmount,
    );
    expect(await token1.balanceOf(await deftPair.getAddress())).to.eq(
      token1Amount + swapAmount,
    );

    const totalSupplyToken0 = await token0.totalSupply();
    const totalSupplyToken1 = await token1.totalSupply();

    expect(await token0.balanceOf(wallet.address)).to.eq(
      totalSupplyToken0 - token0Amount + expectedOutputAmount,
    );
    expect(await token1.balanceOf(wallet.address)).to.eq(
      totalSupplyToken1 - token1Amount - swapAmount,
    );
  });

  it("swap:gas", async () => {
    const token0Amount = expandTo18Decimals(5);
    const token1Amount = expandTo18Decimals(10);
    const swapAmount = expandTo18Decimals(1);
    const expectedOutputAmount = 453305446940074565n;

    const { wallet, token0, token1, deftPair } = await loadFixture(fixture);

    await addLiquidity(
      token0,
      token1,
      deftPair,
      wallet,
      token0Amount,
      token1Amount,
    );

    // ensure that setting price{0,1}CumulativeLast for the first time doesn't affect our gas math
    await ethers.provider.send("evm_mine", [
      (await wallet.provider.getBlock("latest"))!.timestamp + 1,
    ]);

    await time.setNextBlockTimestamp(
      (await wallet.provider.getBlock("latest"))!.timestamp + 1,
    );

    await deftPair.sync();

    await token1.transfer(await deftPair.getAddress(), swapAmount);

    await time.setNextBlockTimestamp(
      (await wallet.provider.getBlock("latest"))!.timestamp + 1,
    );

    const tx = await deftPair.swap(
      expectedOutputAmount,
      0,
      wallet.address,
      "0x",
    );

    const receipt = await tx.wait();

    expect(receipt!.gasUsed).to.eq(73959);
  });

  it("burn", async () => {
    const token0Amount = expandTo18Decimals(3);
    const token1Amount = token0Amount;
    const expectedLiquidity = token0Amount;

    const { wallet, token0, token1, deftPair } = await loadFixture(fixture);

    await addLiquidity(
      token0,
      token1,
      deftPair,
      wallet,
      token0Amount,
      token1Amount,
    );

    await deftPair.transfer(
      await deftPair.getAddress(),
      expectedLiquidity - MINIMUM_LIQUIDITY,
    );

    await expect(deftPair.burn(wallet.address))
      .to.emit(deftPair, "Transfer")
      .withArgs(
        await deftPair.getAddress(),
        ethers.ZeroAddress,
        expectedLiquidity - MINIMUM_LIQUIDITY,
      )
      .to.emit(token0, "Transfer")
      .withArgs(
        await deftPair.getAddress(),
        wallet.address,
        token0Amount - 1000n,
      )
      .to.emit(token1, "Transfer")
      .withArgs(
        await deftPair.getAddress(),
        wallet.address,
        token1Amount - 1000n,
      )
      .to.emit(deftPair, "Sync")
      .withArgs(1000, 1000)
      .to.emit(deftPair, "Burn")
      .withArgs(
        wallet.address,
        token0Amount - 1000n,
        token1Amount - 1000n,
        wallet.address,
      );

    expect(await deftPair.balanceOf(wallet.address)).to.eq(0);

    expect(await deftPair.totalSupply()).to.eq(MINIMUM_LIQUIDITY);

    expect(await token0.balanceOf(await deftPair.getAddress())).to.eq(1000);
    expect(await token1.balanceOf(await deftPair.getAddress())).to.eq(1000);

    const totalSupplyToken0 = await token0.totalSupply();
    const totalSupplyToken1 = await token1.totalSupply();

    expect(await token0.balanceOf(wallet.address)).to.eq(
      totalSupplyToken0 - 1000n,
    );
    expect(await token1.balanceOf(wallet.address)).to.eq(
      totalSupplyToken1 - 1000n,
    );
  });

  it("price{0,1}CumulativeLast", async () => {
    const token0Amount = expandTo18Decimals(3);
    const token1Amount = token0Amount;
    const swapAmount = token0Amount;
    const initialPrice = encodePrice(token0Amount, token1Amount);

    const { wallet, token0, token1, deftPair } = await loadFixture(fixture);

    await addLiquidity(
      token0,
      token1,
      deftPair,
      wallet,
      token0Amount,
      token1Amount,
    );

    const blockTimestamp = (await deftPair.getReserves())[2];

    await time.setNextBlockTimestamp(blockTimestamp + 1n);

    await deftPair.sync();

    expect(await deftPair.price0CumulativeLast()).to.eq(initialPrice[0]);
    expect(await deftPair.price1CumulativeLast()).to.eq(initialPrice[1]);

    expect((await deftPair.getReserves())[2]).to.eq(blockTimestamp + 1n);

    await token0.transfer(await deftPair.getAddress(), swapAmount);

    await time.setNextBlockTimestamp(blockTimestamp + 10n);

    // swap to a new price eagerly instead of syncing
    await deftPair.swap(0, expandTo18Decimals(1), wallet.address, "0x"); // make the price nice

    expect(await deftPair.price0CumulativeLast()).to.eq(initialPrice[0] * 10n);
    expect(await deftPair.price1CumulativeLast()).to.eq(initialPrice[1] * 10n);

    expect((await deftPair.getReserves())[2]).to.eq(blockTimestamp + 10n);

    await time.setNextBlockTimestamp(blockTimestamp + 20n);

    await deftPair.sync();

    const newPrice = encodePrice(expandTo18Decimals(6), expandTo18Decimals(2));

    expect(await deftPair.price0CumulativeLast()).to.eq(
      initialPrice[0] * 10n + newPrice[0] * 10n,
    );
    expect(await deftPair.price1CumulativeLast()).to.eq(
      initialPrice[1] * 10n + newPrice[1] * 10n,
    );

    expect((await deftPair.getReserves())[2]).to.eq(blockTimestamp + 20n);
  });

  it("feeTo:off", async () => {
    const token0Amount = expandTo18Decimals(1000);
    const token1Amount = token0Amount;
    const swapAmount = expandTo18Decimals(1);
    const expectedOutputAmount = 996006981039903216n;
    const expectedLiquidity = token0Amount;

    const { wallet, token0, token1, deftPair } = await loadFixture(fixture);

    await addLiquidity(
      token0,
      token1,
      deftPair,
      wallet,
      token0Amount,
      token1Amount,
    );

    await token1.transfer(await deftPair.getAddress(), swapAmount);

    await deftPair.swap(expectedOutputAmount, 0, wallet.address, "0x");

    await deftPair.transfer(
      await deftPair.getAddress(),
      expectedLiquidity - MINIMUM_LIQUIDITY,
    );

    await deftPair.burn(wallet.address);

    expect(await deftPair.totalSupply()).to.eq(MINIMUM_LIQUIDITY);
  });

  it("feeTo:on", async () => {
    const token0Amount = expandTo18Decimals(1000);
    const token1Amount = token0Amount;
    const swapAmount = expandTo18Decimals(1);
    const expectedOutputAmount = 996006981039903216n;
    const expectedLiquidity = token0Amount;

    const { wallet, other, token0, token1, deftFactory, deftPair } =
      await loadFixture(fixture);

    await deftFactory.setFeeTo(other.address);

    await addLiquidity(
      token0,
      token1,
      deftPair,
      wallet,
      token0Amount,
      token1Amount,
    );

    await token1.transfer(await deftPair.getAddress(), swapAmount);

    await deftPair.swap(expectedOutputAmount, 0, wallet.address, "0x");

    await deftPair.transfer(
      await deftPair.getAddress(),
      expectedLiquidity - MINIMUM_LIQUIDITY,
    );

    await deftPair.burn(wallet.address);

    expect(await deftPair.totalSupply()).to.eq(
      MINIMUM_LIQUIDITY + 249750499251388n,
    );

    expect(await deftPair.balanceOf(other.address)).to.eq(249750499251388n);

    // using 1000 here instead of the symbolic MINIMUM_LIQUIDITY because the amounts only happen to be equal...
    // ...because the initial liquidity amounts were equal
    expect(await token0.balanceOf(await deftPair.getAddress())).to.eq(
      1000n + 249501683697445n,
    );
    expect(await token1.balanceOf(await deftPair.getAddress())).to.eq(
      1000n + 250000187312969n,
    );
  });
});
