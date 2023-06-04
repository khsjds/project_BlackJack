var Blackjack = artifacts.require("./BlackJack.sol");

module.exports = function(deployer) {
  deployer.deploy(Blackjack);
};
