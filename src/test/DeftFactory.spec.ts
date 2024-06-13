import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { DeftFactory, DeftPair } from "../../typechain-types";
import { PAIR_HASH, TEST_ADDRESSES } from "./shared/constants";
import { getDeftPairCreate2Address } from "./shared/utilities";

describe("DeftFactory", () => {
  async function fixture() {
    const [wallet, other] = await ethers.getSigners();

    const DEFT_FACTORY_MOCK = await ethers.getContractFactory("DeftFactory");

    const deftFactory = await DEFT_FACTORY_MOCK.deploy(wallet.address);

    return { wallet, other, deftFactory };
  }

  it("feeTo, feeToSetter, allPairsLength", async () => {
    const { wallet, deftFactory } = await loadFixture(fixture);

    expect(await deftFactory.feeTo()).to.eq(ethers.ZeroAddress);

    expect(await deftFactory.feeToSetter()).to.eq(wallet.address);

    expect(await deftFactory.allPairsLength()).to.eq(0);
  });

  async function createPair(
    deftFactory: DeftFactory,
    tokens: [string, string],
  ) {
    const DEFT_PAIR_MOCK = await ethers.getContractFactory("DeftPair");

    const deftFactoryAddress = await deftFactory.getAddress();

    const deftPairCreate2Address = getDeftPairCreate2Address(
      deftFactoryAddress,
      tokens,
      DEFT_PAIR_MOCK.bytecode,
    );

    await expect(deftFactory.createPair(tokens[0], tokens[1]))
      .to.emit(deftFactory, "PairCreated")
      .withArgs(
        TEST_ADDRESSES[0],
        TEST_ADDRESSES[1],
        deftPairCreate2Address,
        1,
      );

    await expect(deftFactory.createPair(tokens[0], tokens[1])).to.be.reverted; // DeftFactory: PAIR_EXISTS
    await expect(deftFactory.createPair(tokens[1], tokens[0])).to.be.reverted; // DeftFactory: PAIR_EXISTS

    expect(await deftFactory.getPair(tokens[0], tokens[1])).to.eq(
      deftPairCreate2Address,
    );
    expect(await deftFactory.getPair(tokens[1], tokens[0])).to.eq(
      deftPairCreate2Address,
    );

    expect(await deftFactory.allPairs(0)).to.eq(deftPairCreate2Address);

    expect(await deftFactory.allPairsLength()).to.eq(1);

    const deftPair = DEFT_PAIR_MOCK.attach(deftPairCreate2Address) as DeftPair;

    expect(await deftPair.FACTORY()).to.eq(deftFactoryAddress);

    expect(await deftPair.token0()).to.eq(TEST_ADDRESSES[0]);
    expect(await deftPair.token1()).to.eq(TEST_ADDRESSES[1]);
  }

  it("Pair:codeHash", async () => {
    const { deftFactory } = await loadFixture(fixture);

    const codehash = await deftFactory.PAIR_HASH();

    expect(codehash).to.be.eq(PAIR_HASH);
  });

  it("createPair", async () => {
    const { deftFactory } = await loadFixture(fixture);

    await createPair(deftFactory, [...TEST_ADDRESSES]);
  });

  it("createPair:reverse", async () => {
    const { deftFactory } = await loadFixture(fixture);

    await createPair(
      deftFactory,
      TEST_ADDRESSES.slice().reverse() as [string, string],
    );
  });

  it("createPair:gas", async () => {
    const { deftFactory } = await loadFixture(fixture);

    const tx = await deftFactory.createPair(...TEST_ADDRESSES);

    const receipt = await tx.wait();

    expect(receipt!.gasUsed).to.eq(2356517);
  });

  it("setFeeTo", async () => {
    const { wallet, other, deftFactory } = await loadFixture(fixture);

    await expect(
      deftFactory.connect(other).setFeeTo(other.address),
    ).to.be.revertedWith("DeftFactory: FORBIDDEN");

    await deftFactory.setFeeTo(wallet.address);

    expect(await deftFactory.feeTo()).to.eq(wallet.address);
  });

  it("setFeeToSetter", async () => {
    const { wallet, other, deftFactory } = await loadFixture(fixture);

    await expect(
      deftFactory.connect(other).setFeeToSetter(other.address),
    ).to.be.revertedWith("DeftFactory: FORBIDDEN");

    await deftFactory.setFeeToSetter(other.address);

    expect(await deftFactory.feeToSetter()).to.eq(other.address);

    await expect(deftFactory.setFeeToSetter(wallet.address)).to.be.revertedWith(
      "DeftFactory: FORBIDDEN",
    );
  });
});
