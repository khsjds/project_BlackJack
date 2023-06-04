const Blackjack = artifacts.require("BlackJack");

module.exports = function(deployer) {
  deployer.deploy(Blackjack);
};
