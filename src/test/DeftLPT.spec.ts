import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {
  DEFT_DEX_VERSION,
  TOTAL_SUPPLY,
  TEST_AMOUNT,
} from "./shared/constants";

describe("DeftLPT", () => {
  async function fixture() {
    const [wallet, other] = await ethers.getSigners();

    const DEFT_LPT_MOCK = await ethers.getContractFactory("ERC20");

    const deftLPtoken = await DEFT_LPT_MOCK.deploy(TOTAL_SUPPLY);

    const deftLPtokenAddress = await deftLPtoken.getAddress();

    return { wallet, other, deftLPtoken, deftLPtokenAddress };
  }

  it("name, symbol, decimals, totalSupply, balanceOf, DOMAIN_SEPARATOR, PERMIT_TYPEHASH", async () => {
    const { wallet, deftLPtoken, deftLPtokenAddress } =
      await loadFixture(fixture);

    const name = await deftLPtoken.name();

    expect(name).to.eq("Deft LP Token");

    expect(await deftLPtoken.symbol()).to.eq("LP-DEFT");

    expect(await deftLPtoken.decimals()).to.eq(18);

    expect(await deftLPtoken.totalSupply()).to.eq(TOTAL_SUPPLY);

    expect(await deftLPtoken.balanceOf(wallet.address)).to.eq(TOTAL_SUPPLY);

    const { chainId } = await wallet.provider.getNetwork();

    expect(await deftLPtoken.DOMAIN_SEPARATOR()).to.eq(
      ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["bytes32", "bytes32", "bytes32", "uint256", "address"],
          [
            ethers.keccak256(
              ethers.toUtf8Bytes(
                "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)",
              ),
            ),
            ethers.keccak256(ethers.toUtf8Bytes(name)),
            ethers.keccak256(ethers.toUtf8Bytes(DEFT_DEX_VERSION)),
            chainId,
            await deftLPtokenAddress,
          ],
        ),
      ),
    );

    expect(await deftLPtoken.PERMIT_TYPEHASH()).to.eq(
      ethers.keccak256(
        ethers.toUtf8Bytes(
          "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)",
        ),
      ),
    );
  });

  it("approve", async () => {
    const { wallet, other, deftLPtoken } = await loadFixture(fixture);

    await expect(deftLPtoken.approve(other.address, TEST_AMOUNT))
      .to.emit(deftLPtoken, "Approval")
      .withArgs(wallet.address, other.address, TEST_AMOUNT);

    expect(await deftLPtoken.allowance(wallet.address, other.address)).to.eq(
      TEST_AMOUNT,
    );
  });

  it("transfer", async () => {
    const { wallet, other, deftLPtoken } = await loadFixture(fixture);

    await expect(deftLPtoken.transfer(other.address, TEST_AMOUNT))
      .to.emit(deftLPtoken, "Transfer")
      .withArgs(wallet.address, other.address, TEST_AMOUNT);

    expect(await deftLPtoken.balanceOf(wallet.address)).to.eq(
      TOTAL_SUPPLY - TEST_AMOUNT,
    );

    expect(await deftLPtoken.balanceOf(other.address)).to.eq(TEST_AMOUNT);
  });

  it("transfer:fail", async () => {
    const { wallet, other, deftLPtoken } = await loadFixture(fixture);

    await expect(deftLPtoken.transfer(other.address, TOTAL_SUPPLY + 1n)).to.be
      .reverted; // ds-math-sub-underflow

    await expect(deftLPtoken.connect(other).transfer(wallet.address, 1n)).to.be
      .reverted; // ds-math-sub-underflow
  });

  it("transferFrom", async () => {
    const { wallet, other, deftLPtoken } = await loadFixture(fixture);

    await deftLPtoken.approve(other.address, TEST_AMOUNT);

    await expect(
      deftLPtoken
        .connect(other)
        .transferFrom(wallet.address, other.address, TEST_AMOUNT),
    )
      .to.emit(deftLPtoken, "Transfer")
      .withArgs(wallet.address, other.address, TEST_AMOUNT);
    expect(await deftLPtoken.allowance(wallet.address, other.address)).to.eq(
      0n,
    );

    expect(await deftLPtoken.balanceOf(wallet.address)).to.eq(
      TOTAL_SUPPLY - TEST_AMOUNT,
    );

    expect(await deftLPtoken.balanceOf(other.address)).to.eq(TEST_AMOUNT);
  });

  it("transferFrom:max", async () => {
    const { wallet, other, deftLPtoken } = await loadFixture(fixture);

    await deftLPtoken.approve(other.address, ethers.MaxUint256);

    await expect(
      deftLPtoken
        .connect(other)
        .transferFrom(wallet.address, other.address, TEST_AMOUNT),
    )
      .to.emit(deftLPtoken, "Transfer")
      .withArgs(wallet.address, other.address, TEST_AMOUNT);

    expect(await deftLPtoken.allowance(wallet.address, other.address)).to.eq(
      ethers.MaxUint256,
    );

    expect(await deftLPtoken.balanceOf(wallet.address)).to.eq(
      TOTAL_SUPPLY - TEST_AMOUNT,
    );

    expect(await deftLPtoken.balanceOf(other.address)).to.eq(TEST_AMOUNT);
  });

  it("permit", async () => {
    const deadline = ethers.MaxUint256;

    const { wallet, other, deftLPtoken, deftLPtokenAddress } =
      await loadFixture(fixture);

    const nonce = await deftLPtoken.nonces(wallet.address);

    const { chainId } = await wallet.provider.getNetwork();

    const deftLPtokenName = await deftLPtoken.name();

    const sig = await wallet.signTypedData(
      // "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
      {
        name: deftLPtokenName,
        version: DEFT_DEX_VERSION,
        chainId: chainId,
        verifyingContract: await deftLPtokenAddress,
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
        spender: other.address,
        value: TEST_AMOUNT,
        nonce: nonce,
        deadline: deadline,
      },
    );

    const { r, s, v } = ethers.Signature.from(sig);

    await expect(
      deftLPtoken.permit(
        wallet.address,
        other.address,
        TEST_AMOUNT,
        deadline,
        v,
        r,
        s,
      ),
    )
      .to.emit(deftLPtoken, "Approval")
      .withArgs(wallet.address, other.address, TEST_AMOUNT);

    expect(await deftLPtoken.allowance(wallet.address, other.address)).to.eq(
      TEST_AMOUNT,
    );

    expect(await deftLPtoken.nonces(wallet.address)).to.eq(1n);
  });
});
