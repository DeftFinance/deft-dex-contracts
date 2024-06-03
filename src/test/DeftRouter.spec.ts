import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import {
  DEFT_DEX_VERSION,
  MINIMUM_LIQUIDITY,
  TOTAL_SUPPLY,
} from "./shared/constants";
import { expandTo18Decimals } from "./shared/utilities";
import { DeftPair } from "../../typechain-types";

describe("DeftRouter", () => {
  async function fixture() {
    const [wallet] = await ethers.getSigners();

    const [
      WETH_MOCK,
      ERC20_MOCK,
      DEFT_FACTORY_MOCK,
      DEFT_PAIR_MOCK,
      DEFT_ROUTER,
      ROUTER_EMIT_MOCK,
    ] = await Promise.all([
      ethers.getContractFactory("WETH9"),
      ethers.getContractFactory("ERC20"),
      ethers.getContractFactory("DeftFactory"),
      ethers.getContractFactory("DeftPair"),
      ethers.getContractFactory("DeftRouter"),
      ethers.getContractFactory("RouterEventEmitter"),
    ]);

    const [WETH, WETHPartner, tokenA, tokenB, deftFactory, routerEmit] =
      await Promise.all([
        WETH_MOCK.deploy(),
        ERC20_MOCK.deploy(TOTAL_SUPPLY),
        ERC20_MOCK.deploy(TOTAL_SUPPLY),
        ERC20_MOCK.deploy(TOTAL_SUPPLY),
        DEFT_FACTORY_MOCK.deploy(wallet.address),
        ROUTER_EMIT_MOCK.deploy(),
      ]);

    const [
      WETHAddress,
      WETHPartnerAddress,
      tokenAaddress,
      tokenBaddress,
      deftFactoryAddress,
      routerEmitAddress,
    ] = await Promise.all([
      WETH.getAddress(),
      WETHPartner.getAddress(),
      tokenA.getAddress(),
      tokenB.getAddress(),
      deftFactory.getAddress(),
      routerEmit.getAddress(),
    ]);

    const deftRouter = await DEFT_ROUTER.deploy(
      deftFactoryAddress,
      WETHAddress,
    );

    const deftRouterAddress = await deftRouter.getAddress();

    await deftFactory.createPair(tokenAaddress, tokenBaddress);

    const deftPairAddress = await deftFactory.getPair(
      tokenAaddress,
      tokenBaddress,
    );

    const deftPair = (await DEFT_PAIR_MOCK.attach(deftPairAddress)) as DeftPair;

    const token0Address = await deftPair.token0();
    const token1Address = await deftPair.token1();

    const token0 = tokenAaddress === token0Address ? tokenA : tokenB;
    const token1 = tokenBaddress === token1Address ? tokenB : tokenA;

    await deftFactory.createPair(WETHAddress, WETHPartnerAddress);

    const WETHPairAddress = await deftFactory.getPair(
      WETHAddress,
      WETHPartnerAddress,
    );

    const WETHPair = new Contract(
      WETHPairAddress,
      DEFT_PAIR_MOCK.interface,
      wallet,
    );

    return {
      wallet,
      WETH,
      WETHPartner,
      token0,
      token1,
      deftFactory,
      WETHPair,
      deftPair,
      deftRouter,
      routerEmit,
      WETHAddress,
      WETHPartnerAddress,
      token0Address,
      token1Address,
      deftFactoryAddress,
      WETHPairAddress,
      deftPairAddress,
      deftRouterAddress,
      routerEmitAddress,
    };
  }

  it("quote", async () => {
    const { deftRouter } = await loadFixture(fixture);

    expect(await deftRouter.quote(1n, 100n, 200n)).to.eq(2n);

    expect(await deftRouter.quote(2n, 200n, 100n)).to.eq(1n);

    await expect(deftRouter.quote(0n, 100n, 200n)).to.be.revertedWith(
      "DeftLib: INSUFFICIENT_AMOUNT",
    );

    await expect(deftRouter.quote(1n, 0n, 200n)).to.be.revertedWith(
      "DeftLib: INSUFFICIENT_LIQUIDITY",
    );

    await expect(deftRouter.quote(1n, 100n, 0n)).to.be.revertedWith(
      "DeftLib: INSUFFICIENT_LIQUIDITY",
    );
  });

  it("getAmountOut", async () => {
    const { deftRouter } = await loadFixture(fixture);

    expect(await deftRouter.getAmountOut(2n, 100n, 100n)).to.eq(1n);

    await expect(deftRouter.getAmountOut(0n, 100n, 100n)).to.be.revertedWith(
      "DeftLib: INSUFFICIENT_INPUT_AMOUNT",
    );

    await expect(deftRouter.getAmountOut(2n, 0n, 100n)).to.be.revertedWith(
      "DeftLib: INSUFFICIENT_LIQUIDITY",
    );

    await expect(deftRouter.getAmountOut(2n, 100n, 0n)).to.be.revertedWith(
      "DeftLib: INSUFFICIENT_LIQUIDITY",
    );
  });

  it("getAmountIn", async () => {
    const { deftRouter } = await loadFixture(fixture);

    expect(await deftRouter.getAmountIn(1n, 100n, 100n)).to.eq(2n);

    await expect(deftRouter.getAmountIn(0n, 100n, 100n)).to.be.revertedWith(
      "DeftLib: INSUFFICIENT_OUTPUT_AMOUNT",
    );

    await expect(deftRouter.getAmountIn(1n, 0n, 100n)).to.be.revertedWith(
      "DeftLib: INSUFFICIENT_LIQUIDITY",
    );

    await expect(deftRouter.getAmountIn(1n, 100n, 0n)).to.be.revertedWith(
      "DeftLib: INSUFFICIENT_LIQUIDITY",
    );
  });

  it("getAmountsOut", async () => {
    const {
      wallet,
      token0,
      token1,
      deftRouter,
      token0Address,
      token1Address,
      deftRouterAddress,
    } = await loadFixture(fixture);

    const path = [token0Address, token1Address];

    await token0.approve(deftRouterAddress, ethers.MaxUint256);
    await token1.approve(deftRouterAddress, ethers.MaxUint256);

    await deftRouter.addLiquidity(
      token0Address,
      token1Address,
      10000n,
      10000n,
      0,
      0,
      wallet.address,
      ethers.MaxUint256,
    );

    await expect(
      deftRouter.getAmountsOut(2n, [token0Address]),
    ).to.be.revertedWith("DeftLib: INVALID_PATH");

    expect(await deftRouter.getAmountsOut(2n, path)).to.deep.eq([2n, 1n]);
  });

  it("getAmountsIn", async () => {
    const {
      wallet,
      token0,
      token1,
      deftRouter,
      token0Address,
      token1Address,
      deftRouterAddress,
    } = await loadFixture(fixture);

    const path = [token0Address, token1Address];

    await token0.approve(deftRouterAddress, ethers.MaxUint256);
    await token1.approve(deftRouterAddress, ethers.MaxUint256);

    await deftRouter.addLiquidity(
      token0Address,
      token1Address,
      10000n,
      10000n,
      0,
      0,
      wallet.address,
      ethers.MaxUint256,
    );

    await expect(
      deftRouter.getAmountsIn(1n, [token0Address]),
    ).to.be.revertedWith("DeftLib: INVALID_PATH");

    expect(await deftRouter.getAmountsIn(1n, path)).to.deep.eq([2n, 1n]);
  });

  it("factory, WETH", async () => {
    const { deftRouter, WETHAddress, deftFactoryAddress } =
      await loadFixture(fixture);

    expect(await deftRouter.WNC()).to.eq(WETHAddress);

    expect(await deftRouter.FACTORY()).to.eq(deftFactoryAddress);
  });

  it("addLiquidity", async () => {
    const token0Amount = expandTo18Decimals(1);
    const token1Amount = expandTo18Decimals(4);
    const expectedLiquidity = expandTo18Decimals(2);

    const {
      wallet,
      token0,
      token1,
      deftPair,
      deftRouter,
      token0Address,
      token1Address,
      deftPairAddress,
      deftRouterAddress,
    } = await loadFixture(fixture);

    await token0.approve(deftRouterAddress, ethers.MaxUint256);
    await token1.approve(deftRouterAddress, ethers.MaxUint256);

    await expect(
      deftRouter.addLiquidity(
        token0Address,
        token1Address,
        token0Amount,
        token1Amount,
        0,
        0,
        wallet.address,
        ethers.MaxUint256,
      ),
    )
      .to.emit(token0, "Transfer")
      .withArgs(wallet.address, deftPairAddress, token0Amount)
      .to.emit(token1, "Transfer")
      .withArgs(wallet.address, deftPairAddress, token1Amount)
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
      .withArgs(deftRouterAddress, token0Amount, token1Amount);

    expect(await deftPair.balanceOf(wallet.address)).to.eq(
      expectedLiquidity - MINIMUM_LIQUIDITY,
    );
  });

  it("removeLiquidity", async () => {
    const token0Amount = expandTo18Decimals(1);
    const token1Amount = expandTo18Decimals(4);
    const expectedLiquidity = expandTo18Decimals(2);

    const {
      wallet,
      token0,
      token1,
      deftPair,
      deftRouter,
      token0Address,
      token1Address,
      deftPairAddress,
      deftRouterAddress,
    } = await loadFixture(fixture);

    await token0.transfer(deftPairAddress, token0Amount);
    await token1.transfer(deftPairAddress, token1Amount);

    await deftPair.mint(wallet.address);

    await deftPair.approve(deftRouterAddress, ethers.MaxUint256);

    await expect(
      deftRouter.removeLiquidity(
        token0Address,
        token1Address,
        expectedLiquidity - MINIMUM_LIQUIDITY,
        0,
        0,
        wallet.address,
        ethers.MaxUint256,
      ),
    )
      .to.emit(deftPair, "Transfer")
      .withArgs(
        wallet.address,
        deftPairAddress,
        expectedLiquidity - MINIMUM_LIQUIDITY,
      )
      .to.emit(deftPair, "Transfer")
      .withArgs(
        deftPairAddress,
        ethers.ZeroAddress,
        expectedLiquidity - MINIMUM_LIQUIDITY,
      )
      .to.emit(token0, "Transfer")
      .withArgs(deftPairAddress, wallet.address, token0Amount - 500n)
      .to.emit(token1, "Transfer")
      .withArgs(deftPairAddress, wallet.address, token1Amount - 2000n)
      .to.emit(deftPair, "Sync")
      .withArgs(500n, 2000n)
      .to.emit(deftPair, "Burn")
      .withArgs(
        deftRouterAddress,
        token0Amount - 500n,
        token1Amount - 2000n,
        wallet.address,
      );

    expect(await deftPair.balanceOf(wallet.address)).to.eq(0);

    const totalSupplyToken0 = await token0.totalSupply();
    const totalSupplyToken1 = await token1.totalSupply();

    expect(await token0.balanceOf(wallet.address)).to.eq(
      totalSupplyToken0 - 500n,
    );
    expect(await token1.balanceOf(wallet.address)).to.eq(
      totalSupplyToken1 - 2000n,
    );
  });

  it("removeLiquidityETH", async () => {
    const ETHAmount = expandTo18Decimals(4);
    const WETHPartnerAmount = expandTo18Decimals(1);
    const expectedLiquidity = expandTo18Decimals(2);

    const {
      wallet,
      WETH,
      WETHPartner,
      WETHPair,
      deftRouter,
      WETHPairAddress,
      WETHPartnerAddress,
      deftRouterAddress,
    } = await loadFixture(fixture);

    await WETH.deposit({ value: ETHAmount });

    await WETH.transfer(WETHPairAddress, ETHAmount);
    await WETHPartner.transfer(WETHPairAddress, WETHPartnerAmount);

    await WETHPair.mint(wallet.address);

    const WETHPairToken0 = await WETHPair.token0();

    await WETHPair.approve(deftRouterAddress, ethers.MaxUint256);

    await expect(
      deftRouter.removeLiquidityETH(
        WETHPartnerAddress,
        expectedLiquidity - MINIMUM_LIQUIDITY,
        0,
        0,
        wallet.address,
        ethers.MaxUint256,
      ),
    )
      .to.emit(WETHPair, "Transfer")
      .withArgs(
        wallet.address,
        WETHPairAddress,
        expectedLiquidity - MINIMUM_LIQUIDITY,
      )
      .to.emit(WETHPair, "Transfer")
      .withArgs(
        WETHPairAddress,
        ethers.ZeroAddress,
        expectedLiquidity - MINIMUM_LIQUIDITY,
      )
      .to.emit(WETH, "Transfer")
      .withArgs(WETHPairAddress, deftRouterAddress, ETHAmount - 2000n)
      .to.emit(WETHPartner, "Transfer")
      .withArgs(WETHPairAddress, deftRouterAddress, WETHPartnerAmount - 500n)
      .to.emit(WETHPartner, "Transfer")
      .withArgs(deftRouterAddress, wallet.address, WETHPartnerAmount - 500n)
      .to.emit(WETHPair, "Sync")
      .withArgs(
        WETHPairToken0 === WETHPartnerAddress ? 500n : 2000n,
        WETHPairToken0 === WETHPartnerAddress ? 2000n : 500n,
      )
      .to.emit(WETHPair, "Burn")
      .withArgs(
        deftRouterAddress,
        WETHPairToken0 === WETHPartnerAddress
          ? WETHPartnerAmount - 500n
          : ETHAmount - 2000n,
        WETHPairToken0 === WETHPartnerAddress
          ? ETHAmount - 2000n
          : WETHPartnerAmount - 500n,
        deftRouterAddress,
      );

    expect(await WETHPair.balanceOf(wallet.address)).to.eq(0);

    const totalSupplyWETH = await WETH.totalSupply();
    const totalSupplyWETHPartner = await WETHPartner.totalSupply();

    expect(await WETH.balanceOf(wallet.address)).to.eq(totalSupplyWETH - 2000n);
    expect(await WETHPartner.balanceOf(wallet.address)).to.eq(
      totalSupplyWETHPartner - 500n,
    );
  });

  it("removeLiquidityWithPermit", async () => {
    const token0Amount = expandTo18Decimals(1);
    const token1Amount = expandTo18Decimals(4);
    const expectedLiquidity = expandTo18Decimals(2);

    const {
      wallet,
      token0,
      token1,
      deftPair,
      deftRouter,
      token0Address,
      token1Address,
      deftPairAddress,
      deftRouterAddress,
    } = await loadFixture(fixture);

    await token0.transfer(deftPairAddress, token0Amount);
    await token1.transfer(deftPairAddress, token1Amount);

    await deftPair.mint(wallet.address);

    const nonce = await deftPair.nonces(wallet.address);

    const tokenName = await deftPair.name();

    const { chainId } = await wallet.provider.getNetwork();

    const sig = await wallet.signTypedData(
      // "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
      {
        name: tokenName,
        version: DEFT_DEX_VERSION,
        chainId: chainId,
        verifyingContract: deftPairAddress,
      },
      // "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
      {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      {
        owner: wallet.address,
        spender: deftRouterAddress,
        value: expectedLiquidity - MINIMUM_LIQUIDITY,
        nonce: nonce,
        deadline: ethers.MaxUint256,
      },
    );

    const { r, s, v } = ethers.Signature.from(sig);

    await deftRouter.removeLiquidityWithPermit(
      token0Address,
      token1Address,
      expectedLiquidity - MINIMUM_LIQUIDITY,
      0,
      0,
      wallet.address,
      ethers.MaxUint256,
      false,
      v,
      r,
      s,
    );
  });

  it("removeLiquidityETHWithPermit", async () => {
    const ETHAmount = expandTo18Decimals(4);
    const WETHPartnerAmount = expandTo18Decimals(1);
    const expectedLiquidity = expandTo18Decimals(2);

    const {
      wallet,
      WETH,
      WETHPartner,
      WETHPair,
      deftRouter,
      WETHPartnerAddress,
      WETHPairAddress,
      deftRouterAddress,
    } = await loadFixture(fixture);

    await WETH.deposit({ value: ETHAmount });

    await WETH.transfer(WETHPairAddress, ETHAmount);
    await WETHPartner.transfer(WETHPairAddress, WETHPartnerAmount);

    await WETHPair.mint(wallet.address);

    const nonce = await WETHPair.nonces(wallet.address);

    const tokenName = await WETHPair.name();
    const { chainId } = await wallet.provider.getNetwork();

    const sig = await wallet.signTypedData(
      // "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
      {
        name: tokenName,
        version: DEFT_DEX_VERSION,
        chainId: chainId,
        verifyingContract: WETHPairAddress,
      },
      // "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
      {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      {
        owner: wallet.address,
        spender: deftRouterAddress,
        value: expectedLiquidity - MINIMUM_LIQUIDITY,
        nonce: nonce,
        deadline: ethers.MaxUint256,
      },
    );

    const { r, s, v } = ethers.Signature.from(sig);

    await deftRouter.removeLiquidityETHWithPermit(
      WETHPartnerAddress,
      expectedLiquidity - MINIMUM_LIQUIDITY,
      0,
      0,
      wallet.address,
      ethers.MaxUint256,
      false,
      v,
      r,
      s,
    );
  });

  describe("swapExactTokensForTokens", () => {
    const token0Amount = expandTo18Decimals(5);
    const token1Amount = expandTo18Decimals(10);
    const swapAmount = expandTo18Decimals(1);
    const expectedOutputAmount = 1662497915624478906n;

    it("happy path", async () => {
      const {
        wallet,
        token0,
        token1,
        deftPair,
        deftRouter,
        token0Address,
        token1Address,
        deftPairAddress,
        deftRouterAddress,
      } = await loadFixture(fixture);

      // before each
      await token0.transfer(deftPairAddress, token0Amount);
      await token1.transfer(deftPairAddress, token1Amount);

      await deftPair.mint(wallet.address);

      await token0.approve(deftRouterAddress, ethers.MaxUint256);

      await expect(
        deftRouter.swapExactTokensForTokens(
          swapAmount,
          0,
          [token0Address, token1Address],
          wallet.address,
          ethers.MaxUint256,
        ),
      )
        .to.emit(token0, "Transfer")
        .withArgs(wallet.address, deftPairAddress, swapAmount)
        .to.emit(token1, "Transfer")
        .withArgs(deftPairAddress, wallet.address, expectedOutputAmount)
        .to.emit(deftPair, "Sync")
        .withArgs(
          token0Amount + swapAmount,
          token1Amount - expectedOutputAmount,
        )
        .to.emit(deftPair, "Swap")
        .withArgs(
          deftRouterAddress,
          swapAmount,
          0,
          0,
          expectedOutputAmount,
          wallet.address,
        );
    });

    it("amounts", async () => {
      const {
        wallet,
        token0,
        token1,
        deftPair,
        routerEmit,
        token0Address,
        token1Address,
        deftPairAddress,
        deftRouterAddress,
        routerEmitAddress,
      } = await loadFixture(fixture);

      // before each
      await token0.transfer(deftPairAddress, token0Amount);
      await token1.transfer(deftPairAddress, token1Amount);

      await deftPair.mint(wallet.address);

      await token0.approve(deftRouterAddress, ethers.MaxUint256);

      await token0.approve(routerEmitAddress, ethers.MaxUint256);

      await expect(
        routerEmit.swapExactTokensForTokens(
          deftRouterAddress,
          swapAmount,
          0,
          [token0Address, token1Address],
          wallet.address,
          ethers.MaxUint256,
        ),
      )
        .to.emit(routerEmit, "Amounts")
        .withArgs([swapAmount, expectedOutputAmount]);
    });

    it("gas", async () => {
      const {
        wallet,
        token0,
        token1,
        deftPair,
        deftRouter,
        token0Address,
        token1Address,
        deftPairAddress,
        deftRouterAddress,
      } = await loadFixture(fixture);

      // before each
      await token0.transfer(deftPairAddress, token0Amount);
      await token1.transfer(deftPairAddress, token1Amount);

      await deftPair.mint(wallet.address);

      await token0.approve(deftRouterAddress, ethers.MaxUint256);

      // ensure that setting price{0,1}CumulativeLast for the first time doesn't affect our gas math
      await time.setNextBlockTimestamp(
        (await ethers.provider.getBlock("latest"))!.timestamp + 1,
      );

      await deftPair.sync();

      await token0.approve(deftRouterAddress, ethers.MaxUint256);

      await time.setNextBlockTimestamp(
        (await ethers.provider.getBlock("latest"))!.timestamp + 1,
      );

      const tx = await deftRouter.swapExactTokensForTokens(
        swapAmount,
        0,
        [token0Address, token1Address],
        wallet.address,
        ethers.MaxUint256,
      );

      const receipt = await tx.wait();

      expect(receipt!.gasUsed).to.eq(101097, "gas used");
    });
  });

  describe("swapTokensForExactTokens", () => {
    const token0Amount = expandTo18Decimals(5);
    const token1Amount = expandTo18Decimals(10);
    const expectedSwapAmount = 557227237267357629n;
    const outputAmount = expandTo18Decimals(1);

    it("happy path", async () => {
      const {
        wallet,
        token0,
        token1,
        deftPair,
        deftRouter,
        token0Address,
        token1Address,
        deftPairAddress,
        deftRouterAddress,
      } = await loadFixture(fixture);

      // before each
      await token0.transfer(deftPairAddress, token0Amount);
      await token1.transfer(deftPairAddress, token1Amount);

      await deftPair.mint(wallet.address);

      await token0.approve(deftRouterAddress, ethers.MaxUint256);

      await expect(
        deftRouter.swapTokensForExactTokens(
          outputAmount,
          ethers.MaxUint256,
          [token0Address, token1Address],
          wallet.address,
          ethers.MaxUint256,
        ),
      )
        .to.emit(token0, "Transfer")
        .withArgs(wallet.address, deftPairAddress, expectedSwapAmount)
        .to.emit(token1, "Transfer")
        .withArgs(deftPairAddress, wallet.address, outputAmount)
        .to.emit(deftPair, "Sync")
        .withArgs(
          token0Amount + expectedSwapAmount,
          token1Amount - outputAmount,
        )
        .to.emit(deftPair, "Swap")
        .withArgs(
          deftRouterAddress,
          expectedSwapAmount,
          0,
          0,
          outputAmount,
          wallet.address,
        );
    });

    it("amounts", async () => {
      const {
        wallet,
        token0,
        token1,
        deftPair,
        routerEmit,
        token0Address,
        token1Address,
        deftPairAddress,
        deftRouterAddress,
        routerEmitAddress,
      } = await loadFixture(fixture);

      // before each
      await token0.transfer(deftPairAddress, token0Amount);
      await token1.transfer(deftPairAddress, token1Amount);

      await deftPair.mint(wallet.address);

      await token0.approve(routerEmitAddress, ethers.MaxUint256);

      await expect(
        routerEmit.swapTokensForExactTokens(
          deftRouterAddress,
          outputAmount,
          ethers.MaxUint256,
          [token0Address, token1Address],
          wallet.address,
          ethers.MaxUint256,
        ),
      )
        .to.emit(routerEmit, "Amounts")
        .withArgs([expectedSwapAmount, outputAmount]);
    });
  });

  describe("swapExactETHForTokens", () => {
    const ETHAmount = expandTo18Decimals(5);
    const WETHPartnerAmount = expandTo18Decimals(10);
    const swapAmount = expandTo18Decimals(1);
    const expectedOutputAmount = 1662497915624478906n;

    it("happy path", async () => {
      const {
        wallet,
        WETH,
        WETHPartner,
        token0,
        WETHPair,
        deftRouter,
        WETHAddress,
        WETHPartnerAddress,
        WETHPairAddress,
        deftRouterAddress,
      } = await loadFixture(fixture);

      const path = [WETHAddress, WETHPartnerAddress];

      // before each
      await WETH.deposit({ value: ETHAmount });

      await WETH.transfer(WETHPairAddress, ETHAmount);
      await WETHPartner.transfer(WETHPairAddress, WETHPartnerAmount);

      await WETHPair.mint(wallet.address);

      await token0.approve(deftRouterAddress, ethers.MaxUint256);

      const WETHPairToken0 = await WETHPair.token0();

      await expect(
        deftRouter.swapExactETHForTokens(
          0,
          path,
          wallet.address,
          ethers.MaxUint256,
          {
            value: swapAmount,
          },
        ),
      )
        .to.emit(WETH, "Transfer")
        .withArgs(deftRouterAddress, WETHPairAddress, swapAmount)
        .to.emit(WETHPartner, "Transfer")
        .withArgs(WETHPairAddress, wallet.address, expectedOutputAmount)
        .to.emit(WETHPair, "Sync")
        .withArgs(
          WETHPairToken0 === WETHPartnerAddress
            ? WETHPartnerAmount - expectedOutputAmount
            : ETHAmount + swapAmount,
          WETHPairToken0 === WETHPartnerAddress
            ? ETHAmount + swapAmount
            : WETHPartnerAmount - expectedOutputAmount,
        )
        .to.emit(WETHPair, "Swap")
        .withArgs(
          deftRouterAddress,
          WETHPairToken0 === WETHPartnerAddress ? 0 : swapAmount,
          WETHPairToken0 === WETHPartnerAddress ? swapAmount : 0,
          WETHPairToken0 === WETHPartnerAddress ? expectedOutputAmount : 0,
          WETHPairToken0 === WETHPartnerAddress ? 0 : expectedOutputAmount,
          wallet.address,
        );
    });

    it("amounts", async () => {
      const {
        wallet,
        WETH,
        WETHPartner,
        token0,
        WETHPair,
        routerEmit,
        WETHAddress,
        WETHPartnerAddress,
        WETHPairAddress,
        deftRouterAddress,
      } = await loadFixture(fixture);

      const path = [WETHAddress, WETHPartnerAddress];

      // before each
      await WETH.deposit({ value: ETHAmount });

      await WETH.transfer(WETHPairAddress, ETHAmount);
      await WETHPartner.transfer(WETHPairAddress, WETHPartnerAmount);

      await WETHPair.mint(wallet.address);

      await token0.approve(deftRouterAddress, ethers.MaxUint256);

      await expect(
        routerEmit.swapExactETHForTokens(
          deftRouterAddress,
          0,
          path,
          wallet.address,
          ethers.MaxUint256,
          {
            value: swapAmount,
          },
        ),
      )
        .to.emit(routerEmit, "Amounts")
        .withArgs([swapAmount, expectedOutputAmount]);
    });

    it("gas", async () => {
      const ETHAmount = expandTo18Decimals(5);
      const WETHPartnerAmount = expandTo18Decimals(10);
      const swapAmount = expandTo18Decimals(1);

      const {
        wallet,
        WETH,
        WETHPartner,
        token0,
        WETHPair,
        deftPair,
        deftRouter,
        WETHAddress,
        WETHPartnerAddress,
        WETHPairAddress,
        deftRouterAddress,
      } = await loadFixture(fixture);

      const path = [WETHAddress, WETHPartnerAddress];

      // before each
      await WETH.deposit({ value: ETHAmount });

      await WETH.transfer(WETHPairAddress, ETHAmount);
      await WETHPartner.transfer(WETHPairAddress, WETHPartnerAmount);

      await WETHPair.mint(wallet.address);

      await token0.approve(deftRouterAddress, ethers.MaxUint256);

      // ensure that setting price{0,1}CumulativeLast for the first time doesn't affect our gas math
      await time.setNextBlockTimestamp(
        (await wallet.provider.getBlock("latest"))!.timestamp + 1,
      );

      await deftPair.sync();

      await time.setNextBlockTimestamp(
        (await wallet.provider.getBlock("latest"))!.timestamp + 1,
      );

      const tx = await deftRouter.swapExactETHForTokens(
        0,
        path,
        wallet.address,
        ethers.MaxUint256,
        {
          value: swapAmount,
        },
      );

      const receipt = await tx.wait();

      expect(receipt!.gasUsed).to.eq(138689, "gas used");
    }).retries(3);
  });

  describe("swapTokensForExactETH", () => {
    const ETHAmount = expandTo18Decimals(10);
    const WETHPartnerAmount = expandTo18Decimals(5);
    const expectedSwapAmount = 557227237267357629n;
    const outputAmount = expandTo18Decimals(1);

    it("happy path", async () => {
      const {
        wallet,
        WETH,
        WETHPartner,
        WETHPair,
        deftRouter,
        WETHAddress,
        WETHPartnerAddress,
        WETHPairAddress,
        deftRouterAddress,
      } = await loadFixture(fixture);

      const path = [WETHAddress, WETHPartnerAddress];

      // before each
      await WETH.deposit({ value: ETHAmount });

      await WETH.transfer(WETHPairAddress, ETHAmount);
      await WETHPartner.transfer(WETHPairAddress, WETHPartnerAmount);

      await WETHPair.mint(wallet.address);

      await WETHPartner.approve(deftRouterAddress, ethers.MaxUint256);

      const WETHPairToken0 = await WETHPair.token0();

      await expect(
        deftRouter.swapTokensForExactETH(
          outputAmount,
          ethers.MaxUint256,
          path,
          wallet.address,
          ethers.MaxUint256,
        ),
      )
        .to.emit(WETHPartner, "Transfer")
        .withArgs(wallet.address, WETHPairAddress, expectedSwapAmount)
        .to.emit(WETH, "Transfer")
        .withArgs(WETHPairAddress, deftRouterAddress, outputAmount)
        .to.emit(WETHPair, "Sync")
        .withArgs(
          WETHPairToken0 === WETHPartnerAddress
            ? WETHPartnerAmount + expectedSwapAmount
            : ETHAmount - outputAmount,
          WETHPairToken0 === WETHPartnerAddress
            ? ETHAmount - outputAmount
            : WETHPartnerAmount + expectedSwapAmount,
        )
        .to.emit(WETHPair, "Swap")
        .withArgs(
          deftRouterAddress,
          WETHPairToken0 === WETHPartnerAddress ? expectedSwapAmount : 0,
          WETHPairToken0 === WETHPartnerAddress ? 0 : expectedSwapAmount,
          WETHPairToken0 === WETHPartnerAddress ? 0 : outputAmount,
          WETHPairToken0 === WETHPartnerAddress ? outputAmount : 0,
          deftRouterAddress,
        );
    });

    it("amounts", async () => {
      const {
        wallet,
        WETH,
        WETHPartner,
        WETHPair,
        routerEmit,
        WETHAddress,
        WETHPartnerAddress,
        WETHPairAddress,
        deftRouterAddress,
        routerEmitAddress,
      } = await loadFixture(fixture);

      const path = [WETHAddress, WETHPartnerAddress];

      // before each
      await WETH.deposit({ value: ETHAmount });

      await WETH.transfer(WETHPairAddress, ETHAmount);
      await WETHPartner.transfer(WETHPairAddress, WETHPartnerAmount);

      await WETHPair.mint(wallet.address);

      await WETHPartner.approve(routerEmitAddress, ethers.MaxUint256);

      await expect(
        routerEmit.swapTokensForExactETH(
          deftRouterAddress,
          outputAmount,
          ethers.MaxUint256,
          path,
          wallet.address,
          ethers.MaxUint256,
        ),
      )
        .to.emit(routerEmit, "Amounts")
        .withArgs([expectedSwapAmount, outputAmount]);
    });
  });

  describe("swapExactTokensForETH", () => {
    const ETHAmount = expandTo18Decimals(10);
    const WETHPartnerAmount = expandTo18Decimals(5);
    const swapAmount = expandTo18Decimals(1);
    const expectedOutputAmount = 1662497915624478906n;

    it("happy path", async () => {
      const {
        wallet,
        WETH,
        WETHPartner,
        WETHPair,
        deftRouter,
        WETHAddress,
        WETHPartnerAddress,
        WETHPairAddress,
        deftRouterAddress,
      } = await loadFixture(fixture);

      const path = [WETHAddress, WETHPartnerAddress];

      //before each
      await WETH.deposit({ value: ETHAmount });

      await WETH.transfer(WETHPairAddress, ETHAmount);
      await WETHPartner.transfer(WETHPairAddress, WETHPartnerAmount);

      await WETHPair.mint(wallet.address);

      await WETHPartner.approve(deftRouterAddress, ethers.MaxUint256);

      const WETHPairToken0 = await WETHPair.token0();

      await expect(
        deftRouter.swapExactTokensForETH(
          swapAmount,
          0,
          path,
          wallet.address,
          ethers.MaxUint256,
        ),
      )
        .to.emit(WETHPartner, "Transfer")
        .withArgs(wallet.address, WETHPairAddress, swapAmount)
        .to.emit(WETH, "Transfer")
        .withArgs(WETHPairAddress, deftRouterAddress, expectedOutputAmount)
        .to.emit(WETHPair, "Sync")
        .withArgs(
          WETHPairToken0 === WETHPartnerAddress
            ? WETHPartnerAmount + swapAmount
            : ETHAmount - expectedOutputAmount,
          WETHPairToken0 === WETHPartnerAddress
            ? ETHAmount - expectedOutputAmount
            : WETHPartnerAmount + swapAmount,
        )
        .to.emit(WETHPair, "Swap")
        .withArgs(
          deftRouterAddress,
          WETHPairToken0 === WETHPartnerAddress ? swapAmount : 0,
          WETHPairToken0 === WETHPartnerAddress ? 0 : swapAmount,
          WETHPairToken0 === WETHPartnerAddress ? 0 : expectedOutputAmount,
          WETHPairToken0 === WETHPartnerAddress ? expectedOutputAmount : 0,
          deftRouterAddress,
        );
    });

    it("amounts", async () => {
      const {
        wallet,
        WETH,
        WETHPartner,
        WETHPair,
        routerEmit,
        WETHAddress,
        WETHPartnerAddress,
        WETHPairAddress,
        deftRouterAddress,
        routerEmitAddress,
      } = await loadFixture(fixture);

      const path = [WETHAddress, WETHPartnerAddress];

      //before each
      await WETH.deposit({ value: ETHAmount });

      await WETH.transfer(WETHPairAddress, ETHAmount);
      await WETHPartner.transfer(WETHPairAddress, WETHPartnerAmount);

      await WETHPair.mint(wallet.address);

      await WETHPartner.approve(routerEmitAddress, ethers.MaxUint256);

      await expect(
        routerEmit.swapExactTokensForETH(
          deftRouterAddress,
          swapAmount,
          0,
          path,
          wallet.address,
          ethers.MaxUint256,
        ),
      )
        .to.emit(routerEmit, "Amounts")
        .withArgs([swapAmount, expectedOutputAmount]);
    });
  });

  describe("swapETHForExactTokens", () => {
    const ETHAmount = expandTo18Decimals(5);
    const WETHPartnerAmount = expandTo18Decimals(10);
    const expectedSwapAmount = 557227237267357629n;
    const outputAmount = expandTo18Decimals(1);

    it("happy path", async () => {
      const {
        wallet,
        WETH,
        WETHPartner,
        WETHPair,
        deftRouter,
        WETHAddress,
        WETHPartnerAddress,
        WETHPairAddress,
        deftRouterAddress,
      } = await loadFixture(fixture);

      const path = [WETHAddress, WETHPartnerAddress];

      await WETH.deposit({ value: ETHAmount });

      await WETH.transfer(WETHPairAddress, ETHAmount);
      await WETHPartner.transfer(WETHPairAddress, WETHPartnerAmount);

      await WETHPair.mint(wallet.address);

      const WETHPairToken0 = await WETHPair.token0();

      await expect(
        deftRouter.swapETHForExactTokens(
          outputAmount,
          path,
          wallet.address,
          ethers.MaxUint256,
          {
            value: expectedSwapAmount,
          },
        ),
      )
        .to.emit(WETH, "Transfer")
        .withArgs(deftRouterAddress, WETHPairAddress, expectedSwapAmount)
        .to.emit(WETHPartner, "Transfer")
        .withArgs(WETHPairAddress, wallet.address, outputAmount)
        .to.emit(WETHPair, "Sync")
        .withArgs(
          WETHPairToken0 === WETHPartnerAddress
            ? WETHPartnerAmount - outputAmount
            : ETHAmount + expectedSwapAmount,
          WETHPairToken0 === WETHPartnerAddress
            ? ETHAmount + expectedSwapAmount
            : WETHPartnerAmount - outputAmount,
        )
        .to.emit(WETHPair, "Swap")
        .withArgs(
          deftRouterAddress,
          WETHPairToken0 === WETHPartnerAddress ? 0 : expectedSwapAmount,
          WETHPairToken0 === WETHPartnerAddress ? expectedSwapAmount : 0,
          WETHPairToken0 === WETHPartnerAddress ? outputAmount : 0,
          WETHPairToken0 === WETHPartnerAddress ? 0 : outputAmount,
          wallet.address,
        );
    });

    it("amounts", async () => {
      const {
        wallet,
        WETH,
        WETHPartner,
        WETHPair,
        routerEmit,
        WETHAddress,
        WETHPartnerAddress,
        WETHPairAddress,
        deftRouterAddress,
      } = await loadFixture(fixture);

      const path = [WETHAddress, WETHPartnerAddress];

      await WETH.deposit({ value: ETHAmount });

      await WETH.transfer(WETHPairAddress, ETHAmount);
      await WETHPartner.transfer(WETHPairAddress, WETHPartnerAmount);

      await WETHPair.mint(wallet.address);

      await expect(
        routerEmit.swapETHForExactTokens(
          deftRouterAddress,
          outputAmount,
          path,
          wallet.address,
          ethers.MaxUint256,
          {
            value: expectedSwapAmount,
          },
        ),
      )
        .to.emit(routerEmit, "Amounts")
        .withArgs([expectedSwapAmount, outputAmount]);
    });
  });
});
