// SPDX-License-Identifier: MIT
// BlackJack.sol
// BlackJack smart contract
pragma solidity >=0.8.12 <0.9.0;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 @title BlackJack
 A Blackjack game of smart contract, deploying to the blockchain.
*/
contract BlackJack {
    ////////// Basic variables and functions setups //////////
    using SafeMath for uint256;

    struct Game {
        // identifiers
        uint256 Id;
        address Player;
        // player states
        uint256 PlayerBet;
        uint256 PlayerCard1;
        uint256 PlayerCard2;
        uint256 PlayerNewCard;
        uint256 PlayerCardTotal;
        // dealer states
        uint256 DealerCard1;
        uint256 DealerCard2;
        uint256 DealerNewCard;
        uint256 DealerCardTotal;
        // game states
        uint256 SafeBalance;
        uint256 OriginalBalance;
        uint256 GamesPlayed;
        bool HasAce;
        bool IsRoundInProgress;
        string GameMsg;
    }

    // cash related limits
    uint256 constant private _ethDepLimit_Low = 1000 gwei;
    uint256 constant private _ethDepLimit_High = 10 ether;
    uint256 constant private _ethBetLimit_Low = 100 gwei;
    uint256 constant private _ethBetLimit_High = 1 ether; // 1000000000000000000 wei

    // game state vars
    uint256 private _rngNonce;
    uint256 private _indexCounter;
    address immutable private _owner;
    mapping(address => uint256) private _map_playerToGame;
    mapping(uint256 => Game) private _map_idToGame;

    /**
     Events that Log important states (start game, and cash out/transfer)
    */
    event NewGameEvent(uint256 indexed GameId, address indexed Player, uint256 indexed Amount);
    event CashOutEvent(uint256 indexed GameId, address indexed Player, uint256 indexed Amount);
    event BeforeCashOutEvent(uint256 indexed GameId, address indexed Player, uint256 indexed Amount);
    event AfterCashOutEvent(address indexed Player);
    
    /**
     @title IsValidAddr
     A modifier that checks if the user's address is valid.
    */
    modifier IsValidAddr() {
        require(msg.sender != address(0x0), "Error: Address invalid.");
        _;
    }
    
    constructor () {
        _rngNonce = 1;
        _indexCounter = 1;
        _owner = msg.sender;
    }
    
    fallback () IsValidAddr external {
        revert("Payer address inavailable.");
    }

    receive () IsValidAddr external payable {
        // Players must use NewGame function to pay
        revert("Please start new game (NewGame function) to pay contract.");
    }
    
    /**
     @title NewGame
     Starts and initializes a new game with a player using msg.sender's address.
    */
    function NewGame() external payable {
        require(_map_playerToGame[msg.sender] == 0, "Error: Player already in a game.");
        require(msg.value > _ethDepLimit_Low && msg.value <= _ethDepLimit_High, "Error: Require 1000 Gwei < deposit < 10 Ether.");

        Game memory game;
        game.Id = _indexCounter;
        game.SafeBalance += msg.value;
        game.OriginalBalance += msg.value;
        game.Player = msg.sender;
        
        game.GameMsg = "Contract Paid.";
        _indexCounter++;
        _map_idToGame[game.Id] = game;
        _map_playerToGame[msg.sender] = game.Id;

        emit NewGameEvent(game.Id, game.Player, game.OriginalBalance);
    }

    /**
     @title GenerateRandomNumber
     Generates a random number between 1 and 13.
    */
    function GenerateRandomNumber() private returns (uint256 randomNumber) {
        _rngNonce *= 3;
        randomNumber = uint256(keccak256(abi.encodePacked(blockhash(block.timestamp), _rngNonce))) % 13 + 1;

        _rngNonce++;
        
        // reduce gas cost
        if(_rngNonce > 20230516)
            _rngNonce = randomNumber;
    }

    ////////// Core game functions //////////
    /**
     @title GetCard
     Get a card from the deck. Joker(11), Queen(12), King(13) each worth 10 points.
    */
    function GetCard() private returns (uint256 cardValue) {
        cardValue = GenerateRandomNumber();
        if(cardValue > 10)
            cardValue = 10;
    }

    /**
     @title DealCards
     Deals first 2 cards and handle BlackJack, dealer doesn't have card 2 by now.
     @param game Ongoing game ID.
    */
    function DealCards(Game storage game) private {
        // Clear previous states
        game.PlayerCard1 = 0;
        game.PlayerCard2 = 0;
        game.PlayerNewCard = 0;
        game.PlayerCardTotal = 0;
        game.DealerCard1 = 0;
        game.DealerCard2 = 0;
        game.DealerNewCard = 0;
        game.DealerCardTotal = 0;
        game.HasAce = false;
        
        // Card 1
        game.PlayerCard1 = GetCard();
        game.DealerCard1 = GetCard();
        // if Ace
        if(game.PlayerCard1 == 1) {
            game.PlayerCard1 = 11;
            game.HasAce = true;
        }
        if(game.DealerCard1 == 1) 
            game.DealerCard1 = 11;
        
        // Card 2 for player -- dealer gets card in his round only
        game.PlayerCard2 = GetCard();
        if(game.PlayerCard2 == 1 && game.PlayerCard1 < 11) { // if card 2 is Ace
            game.PlayerCard2 = 11;
            game.HasAce = true;
        }
        
        // Card totals
        game.PlayerCardTotal = game.PlayerCard1 + game.PlayerCard2;
        game.DealerCardTotal = game.DealerCard1 + game.DealerCard2; // Card 2 is zero by now
        
        // BlackJack!
        if(game.PlayerCardTotal == 21) {
            // Check standoff
            game.DealerCard2 = GetCard();
            if(game.DealerCard1 == 10 && game.DealerCard2 == 1) {
                game.DealerCard2 = 11;
                
                game.DealerCardTotal = game.DealerCard1 + game.DealerCard2;
            }
            // Identify winner
            if(game.DealerCardTotal == game.PlayerCardTotal) {
                game.GameMsg = "StandOff!";
                game.SafeBalance += game.PlayerBet; // Update balance: bet
            } else {
                game.GameMsg = "BlackJack! Player Wins.";
                game.SafeBalance += ((game.PlayerBet * 2) + (game.PlayerBet / 2)); //update balance: bet * 2.5 = original bet * 2 + bet * 0.5
            }
            // End round since someone won
            game.IsRoundInProgress = false;
        } else {
            game.GameMsg = "Player's Turn.";
        }
    }
    
    /**
     @title Hit
     Called on player's turn: draw a card and check for hands.
    */
    function Hit() IsValidAddr external {
        require(_map_playerToGame[msg.sender] != 0, "Error: Game does not exists.");
        Game storage game = _map_idToGame[_map_playerToGame[msg.sender]];

        require(game.IsRoundInProgress, "Available on player's turn only.");
        game.PlayerNewCard = GetCard();
        // If Ace
        if(game.PlayerNewCard == 1 && game.PlayerCardTotal < 11) {
            game.PlayerNewCard = 11;
            game.HasAce = true;
        }

        game.PlayerCardTotal += game.PlayerNewCard;
        if(game.PlayerCardTotal > 21) { // Bust
            game.GameMsg = "Player Bust.";
            game.IsRoundInProgress = false;
        } else {
            game.GameMsg = "Player's Turn.";
        }
    }
    
    /**
     @title Stand
     Called on player's turn: End player's turns and play dealer's hand.
     Dealer draws cards until 17 or bust, then check winner.
    */
    function Stand() IsValidAddr public {
        require(_map_playerToGame[msg.sender] != 0, "Error: Game does not exists.");
        Game storage game = _map_idToGame[_map_playerToGame[msg.sender]];

        require(game.IsRoundInProgress, "Available on player's turn only.");
        // Show Dealer Card 2
        game.DealerCard2 = GetCard();
        // Ace
        if(game.DealerCard2 == 1 && game.DealerCard1 < 11)
            game.DealerCard2 = 11; 
        
        // Update card Total
        game.DealerCardTotal = game.DealerCard1 + game.DealerCard2;       
        
        // Dealer must Stand on all 17s
        while(game.DealerCardTotal < 17) {
            game.DealerNewCard = GetCard();
            // Ace
            if(game.DealerNewCard == 1 && game.DealerCardTotal < 11)
                game.DealerNewCard = 11;
            
            game.DealerCardTotal += game.DealerNewCard;
        }

        // check winner from here //        
        if(game.DealerCardTotal > 21) {
            game.GameMsg = "Dealer Bust. Player Wins.";
            game.IsRoundInProgress = false;
            game.SafeBalance += (game.PlayerBet * 2); // Update balance: bet * 2

        } else if(game.DealerCardTotal == 21) {
            // check standoff
            if(game.PlayerCardTotal == 21) {
                game.GameMsg = "StandOff!";
                game.IsRoundInProgress = false;
                game.SafeBalance += (game.PlayerBet); // Update balance: bet
            } else {
                game.GameMsg = "Dealer Wins.";
                game.IsRoundInProgress = false;
            }
        } else {
            if(game.PlayerCardTotal < 21 && (21 - game.DealerCardTotal) == (21 - game.PlayerCardTotal)) {
                game.GameMsg = "StandOff!";
                game.IsRoundInProgress = false;
                game.SafeBalance += game.PlayerBet; // Update balance: bet
            } else if((21 - game.DealerCardTotal) < (21 - game.PlayerCardTotal)) {
                game.GameMsg = "Dealer Wins.";
                game.IsRoundInProgress = false;
            } else {
                game.GameMsg = "Player Wins.";
                game.IsRoundInProgress = false;
                game.SafeBalance += (game.PlayerBet * 2); // Update balance: bet * 2
            }
        }
    }

    /**
     @title PlaceBet
     Begins a new game round that saves game states including balance, bet and number of games.
     @param bet Requires 100 GWei < bet < 1 Ether to start a new round.
    */
    function PlaceBet(uint256 bet) IsValidAddr public {
        require(_map_playerToGame[msg.sender] != 0, "Error: Game does not exists.");
        Game storage game = _map_idToGame[_map_playerToGame[msg.sender]];

        require(!game.IsRoundInProgress, "Error: Round in progress.");
        require(bet >= _ethBetLimit_Low && bet <= _ethBetLimit_High, "Error: Require 100 GWei < bet < 1 Ether.");
        require(bet > 0 && bet <= game.SafeBalance, "Error: Insufficient funds.");
        game.SafeBalance -= bet; // Balance update: remove bet amount
        game.PlayerBet = bet; // Update player bet amount
        game.IsRoundInProgress = true; // Start this new round
        game.GamesPlayed++; // Game counter updates
        
        DealCards(game);
    }

    ////////// Cash flow functions //////////
    /**
     @title CashOut
     Cash out function for player before or after a game round.
    */
    function CashOut() IsValidAddr external {
        require(_map_playerToGame[msg.sender] != 0, "Error: Game does not exists.");
        Game memory game = _map_idToGame[_map_playerToGame[msg.sender]];

        require(!game.IsRoundInProgress, "Available on new round only.");
        uint256 tempBalance = game.SafeBalance;
        if(address(this).balance >= 0 && address(this).balance < game.SafeBalance)
            tempBalance = address(this).balance;

        assert(address(this).balance >= tempBalance);
        BeforeValueTransfer(msg.sender);
        payable(msg.sender).transfer(tempBalance);
        AfterValueTransfer(msg.sender);
        assert(_map_playerToGame[msg.sender] == 0);

        emit CashOutEvent(game.Id, msg.sender, tempBalance);
    }

    /**
     @title BeforeValueTransfer
     @param playerAddress Player address to transfer value to.
    */
    function BeforeValueTransfer(address playerAddress) private {
        // Update before transfer to prevent re-entrancy.

        uint256 gameId = _map_idToGame[_map_playerToGame[playerAddress]].Id;
        uint256 tempBalance = _map_idToGame[_map_playerToGame[playerAddress]].SafeBalance;

        _map_playerToGame[playerAddress] = 0;
        delete _map_idToGame[_map_playerToGame[playerAddress]];

        emit BeforeCashOutEvent(gameId, playerAddress, tempBalance);
    }

    /**
     @title AfterValueTransfer
     @param playerAddress Player address to transfer value to.
    */
    function AfterValueTransfer(address playerAddress) private {
        // Ensure transfer happened as expected. If not, update again.

        if(_map_playerToGame[playerAddress] != 0 || _map_idToGame[_map_playerToGame[playerAddress]].SafeBalance != 0) {
            _map_playerToGame[playerAddress] = 0;
            delete _map_idToGame[_map_playerToGame[playerAddress]];
        }

        emit AfterCashOutEvent(playerAddress);
    }

    ////////// Misc functions //////////
    /**
     @dev GetGame - helper function to get game info for msg.sender.
    */
    function GetGame() external view returns (Game memory game) {
        game = _map_idToGame[_map_playerToGame[msg.sender]];
    }
    
    /**
     @dev ShowTable - helper function to display game info for msg.sender.
    */
    function ShowTable() external view returns (
            string memory DealerMessage,   string memory PlayerCard1, string memory PlayerCard2, string memory PlayerNewCard,
            string memory PlayerCardTotal, string memory DealerCard1, string memory DealerCard2, string memory DealerNewCard,
            string memory DealerCardTotal, string memory PlayerBet,   string memory BetPot) {

        Game memory game = _map_idToGame[_map_playerToGame[msg.sender]];
        
        DealerMessage = string.concat(" --> ", game.GameMsg);
        PlayerCard1 = string.concat(" --> ", Strings.toString(game.PlayerCard1));
        PlayerCard2 = string.concat(" --> ", Strings.toString(game.PlayerCard2));
        PlayerNewCard = string.concat(" --> ", Strings.toString(game.PlayerNewCard));
        PlayerCardTotal = string.concat(" ------> ", Strings.toString(game.PlayerCardTotal));
        DealerCard1 = string.concat(" --> ", Strings.toString(game.DealerCard1));
        DealerCard2 = string.concat(" --> ", Strings.toString(game.DealerCard2));
        DealerNewCard = string.concat(" --> ", Strings.toString(game.DealerNewCard));
        DealerCardTotal = string.concat(" ------> ", Strings.toString(game.DealerCardTotal));
        PlayerBet = string.concat(" --> ", Strings.toString(game.PlayerBet), " wei");
        BetPot = string.concat(" --> ", Strings.toString(game.SafeBalance), " wei");
    }
}