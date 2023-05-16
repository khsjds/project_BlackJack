// Load dependencies
//const { ethers } = require("hardhat");
const { expect } = require('chai');

// Import utilities from Test Helpers
const { BN, expectEvent, expectRevert, balance, send, ether } = require('@openzeppelin/test-helpers');

// Load compiled artifacts
const BlackJack = artifacts.require('BlackJack');

// Start test block
// Note: some of the tests below such as GetInsurance, Split, and DoubleDown, may fail as they assume the state of the game once started,
//        and depending on the random numbers generated, the game may not be in the assumed state.
describe('BlackJack', function () {

  context('Ensure txns revert properly', function () {

    const oneEth = ethers.utils.parseEther("1.0")
    const tenEth = ethers.utils.parseEther("10.0")

    before(async function () {
      [owner, player1, player2, player3, player4, other] = await ethers.getSigners();
    });

    beforeEach(async function () {
      this.blackJack = await BlackJack.new({from: owner.address});
    });

    it('Non-player cannot Cash Out', async function () {
      const options = {from: other.address};

      await expectRevert(
        this.blackJack.CashOut(options),
        'Error: Game does not exists.',
      );
    });

    it('Non-player cannot Hit', async function () {
      await expectRevert(
        this.blackJack.Hit({from: other.address}),
        'Error: Game does not exists.',
      );
    });

    it('Non-player cannot Stand', async function () {
      await expectRevert(
        this.blackJack.Stand({from: other.address}),
        'Error: Game does not exists.',
      );
    });

    it('Non-player cannot Place Bet', async function () {
      await expectRevert(
        this.blackJack.PlaceBet(100, {from: other.address}),
        'Error: Game does not exists.',
      );
    });

    it('Player cannot start game without paying', async function () {
      await expectRevert(
        this.blackJack.NewGame({from: other.address}),
        'Error: Require 1000 Gwei < deposit < 10 Ether.',
      );
    });

    it('Player cannot pay invalid deposit', async function () {
      const options = {from: other.address, value: ethers.utils.parseEther("0")}
      await expectRevert(
        this.blackJack.NewGame(options),
        'Error: Require 1000 Gwei < deposit < 10 Ether.',
      );
    });

    it('Player cannot pay less than deposit limit', async function () {
      const options = {from: other.address, value: ethers.utils.parseEther("0.0000000420")}
      await expectRevert(
        this.blackJack.NewGame(options),
        'Error: Require 1000 Gwei < deposit < 10 Ether.',
      );
    });

    it('Player cannot pay more than deposit limit', async function () {
      const options = {from: other.address, value: ethers.utils.parseEther("420.0")}
      await expectRevert(
        this.blackJack.NewGame(options),
        'Error: Require 1000 Gwei < deposit < 10 Ether.',
      );
    });

    it('Player cannot start a new game while another game is in progress', async function () {
      const options = {from: player1.address, value: tenEth}

      await this.blackJack.NewGame(options);

      await expectRevert(
        this.blackJack.NewGame(options),
        'Error: Player already in a game.',
      );
    });

    it('Player cannot place bet if game does not exist', async function () {
      const options = {from: player2.address}
      await expectRevert(
        this.blackJack.PlaceBet(oneEth, options),
        'Error: Game does not exists.',
      );
    });

    it('Player cannot place another bet when a round is in progress', async function () {
      const options = {from: player1.address, value: tenEth}

      await this.blackJack.NewGame(options);
      this.blackJack.PlaceBet(oneEth, {from: player1.address});

      await expectRevert(
        this.blackJack.PlaceBet(oneEth, {from: player1.address}),
        'Error: Round in progress.',
      );
    });

    it('Player cannot place less than bet limit', async function () {
      const options = {from: player1.address, value: tenEth}

      await this.blackJack.NewGame(options);
      
      await expectRevert(
        this.blackJack.PlaceBet(ethers.utils.parseEther("0.00000001"), {from: player1.address}),
        'Error: Require 100 GWei < bet < 1 Ether.',
      );
    });

    it('Player cannot place more than bet limit', async function () {
      const options = {from: player1.address, value: tenEth}

      await this.blackJack.NewGame(options);
      
      await expectRevert(
        this.blackJack.PlaceBet(tenEth, {from: player1.address}),
        'Error: Require 100 GWei < bet < 1 Ether.',
      );
    });

    it('Player cannot place bet they cannot afford', async function () {
      const options = {from: player1.address, value: ethers.utils.parseEther("0.00001")}

      await this.blackJack.NewGame(options);
      
      await expectRevert(
        this.blackJack.PlaceBet(oneEth, {from: player1.address}),
        'Error: Insufficient funds.',
      );
    });

    it('Player cannot hit if game does not exist', async function () {
      const options = {from: player2.address}
      await expectRevert(
        this.blackJack.Hit(options),
        'Error: Game does not exists.',
      );
    });

    it('Player cannot hit when it is not their turn', async function () {
      const options = {from: player1.address, value: tenEth}

      await this.blackJack.NewGame(options);

      await expectRevert(
        this.blackJack.Hit({from: player1.address}),
        'Available on player\'s turn only.',
      );
    });

    it('Player cannot hit after standing to end their turn', async function () {
      const options = {from: player1.address, value: tenEth}

      await this.blackJack.NewGame(options);
      await this.blackJack.PlaceBet(oneEth, {from: player1.address});
      await this.blackJack.Stand({from: player1.address});

      await expectRevert(
        this.blackJack.Hit({from: player1.address}),
        'Available on player\'s turn only.',
      );
    });

    it('Player cannot stand if game does not exist', async function () {
      const options = {from: player2.address}
      await expectRevert(
        this.blackJack.Stand(options),
        'Error: Game does not exists.',
      );
    });

    it('Player cannot stand when it is not their turn', async function () {
      const options = {from: player1.address, value: tenEth}

      await this.blackJack.NewGame(options);

      await expectRevert(
        this.blackJack.Stand({from: player1.address}),
        'Available on player\'s turn only.',
      );
    });

    it('Player cannot stand again after standing to end their turn', async function () {
      const options = {from: player1.address, value: tenEth}

      await this.blackJack.NewGame(options);
      await this.blackJack.PlaceBet(oneEth, {from: player1.address});
      await this.blackJack.Stand({from: player1.address});

      await expectRevert(
        this.blackJack.Stand({from: player1.address}),
        'Available on player\'s turn only.',
      );
    });

    it('Player cannot cash out if game does not exist', async function () {
      const options = {from: player2.address}
      await expectRevert(
        this.blackJack.CashOut(options),
        'Error: Game does not exists.',
      );
    });

    it('Player cannot cash out when a round is in progress', async function () {
      const options = {from: player1.address, value: tenEth}

      await this.blackJack.NewGame(options);
      this.blackJack.PlaceBet(oneEth, {from: player1.address});

      await expectRevert(
        this.blackJack.CashOut({from: player1.address}),
        'Available on new round only.',
      );
    });
  });
});