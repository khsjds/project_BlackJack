import React, { Component } from "react";
import BlackjackContract from "./contracts/BlackJack.json";
import getWeb3 from "./getWeb3";

import "./App.css";

class App extends Component {

    constructor(){
        super();
        this.state = {setDeposit: '', betValue: '', web3: null, playerAccount: null, game: null , dealerHand: [], playerHand: []};
        this.onChange = this.onChange.bind(this);
        this.onChangeDep = this.onChangeDep.bind(this);
    }

    onChangeDep(e){
        const re = /^[0-9\b]+$/;
        if (e.target.value === '' || re.test(e.target.value)) {
            this.setState({setDeposit: e.target.value})
        }
    }

    onChange(e){
        const re = /^[0-9\b]+$/;
        if (e.target.value === '' || re.test(e.target.value)) {
            this.setState({betValue: e.target.value})
        }
    }

    componentDidMount = async () => {
        try {
            // Get network provider and web3 instance.
            const web3 = await getWeb3();

            var playerAccount = web3.currentProvider.selectedAddress;

            // Get the contract instance.
            const networkId = await web3.eth.net.getId();
            const gameNetwork = BlackjackContract.networks[networkId];
            const gameInstance = new web3.eth.Contract(
                BlackjackContract.abi,
                gameNetwork && gameNetwork.address,
            );
            // Set web3, accounts, and contract to the state, and then proceed with an
            // example of interacting with the contract's methods.
            const gameTable = await gameInstance.methods.ShowTable().call();
            this.setState({ web3, playerAccount, game: gameInstance, safeBalance: gameTable.BetPot, gameMessage: gameTable.GameMessage});
//            console.log(this.state);

        } catch (error) {
            // Catch any errors for any of the above operations.
            alert(
                `Failed to load web3, accounts, or contract. Check console for details.`,
            );
            console.error(error);
        }
    };

    newGame = async () => {
        const { playerAccount , game } = this.state;

        await game.methods.NewGame().send({ from: playerAccount, value: this.state.setDeposit, gas: 450000 });

        const gameTable = await game.methods.ShowTable().call();

        this.setState({
            gameMessage: gameTable.GameMessage,
            safeBalance: gameTable.BetPot,
            dealerHand: gameTable.DealerHand,
            playerHand: gameTable.PlayerHand,
            dealerScore: gameTable.DealerCardTotal,
            handScore: gameTable.PlayerCardTotal,
            bet: gameTable.PlayerBet,
        });
    };

    placeBet = async () => {
        const { playerAccount , game } = this.state;

        await game.methods.PlaceBet(this.state.betValue).send({ from: playerAccount, gas: 450000 });

        const gameTable = await game.methods.ShowTable().call();

        this.setState({
            gameMessage: gameTable.GameMessage,
            safeBalance: gameTable.BetPot,
            dealerHand: gameTable.DealerHand,
            playerHand: gameTable.PlayerHand,
            dealerScore: gameTable.DealerCardTotal,
            handScore: gameTable.PlayerCardTotal,
            bet: gameTable.PlayerBet,
        });
    };

    hit = async () => {
        const { playerAccount , game } = this.state;

        await game.methods.Hit().send({ from: playerAccount, gas: 450000 });

        const gameTable = await game.methods.ShowTable().call();

        this.setState({
            gameMessage: gameTable.GameMessage,
            safeBalance: gameTable.BetPot,
            dealerHand: gameTable.DealerHand,
            playerHand: gameTable.PlayerHand,
            dealerScore: gameTable.DealerCardTotal,
            handScore: gameTable.PlayerCardTotal,
            bet: gameTable.PlayerBet,
        });
    };

    stand = async () => {
        const { playerAccount , game } = this.state;

        await game.methods.Stand().send({ from: playerAccount, gas: 450000 });

        const gameTable = await game.methods.ShowTable().call();

        this.setState({
            gameMessage: gameTable.GameMessage,
            safeBalance: gameTable.BetPot,
            dealerHand: gameTable.DealerHand,
            playerHand: gameTable.PlayerHand,
            dealerScore: gameTable.DealerCardTotal,
            handScore: gameTable.PlayerCardTotal,
            bet: gameTable.PlayerBet,
        });
    };

    cashOut = async () => {
        const { playerAccount , game } = this.state;

        await game.methods.CashOut().send({ from: playerAccount, gas: 450000 });

        const gameTable = await game.methods.ShowTable().call();

        this.setState({
            gameMessage: gameTable.GameMessage,
            safeBalance: gameTable.BetPot,
            dealerHand: gameTable.DealerHand,
            playerHand: gameTable.PlayerHand,
            dealerScore: gameTable.DealerCardTotal,
            handScore: gameTable.PlayerCardTotal,
            bet: gameTable.PlayerBet,
        });
    }

    render() {
        const rankStrings = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K"]
        const suitStrings = [String.fromCharCode(9827), String.fromCharCode(9830), String.fromCharCode(9829), String.fromCharCode(9824)]

        let newGameButton;
        let dealButton;
        let standButton;
        let hitButton;
        let cashOutButton;
        if (this.state.gameMessage === "") {
            newGameButton = <button onClick={this.newGame.bind(this)}>New Game</button>;
        } else if (this.state.gameMessage === "Player's Turn.") {
            standButton = <button onClick={this.stand.bind(this)}>Stand</button>;
            hitButton = <button onClick={this.hit.bind(this)}>Hit</button>;
        } else {
            dealButton = <button onClick={this.placeBet.bind(this)}>Deal</button>;
            cashOutButton = <button onClick={this.cashOut.bind(this)}>Cash Out</button>;
        }

        if (!this.state.web3) {
            return <div>Loading Web3, accounts, and contract...</div>;
        }

        const dealerCards = this.state.dealerHand.map(function(card,i){
            return <td align="center" border="20px" key={i}> {rankStrings[card % 13]}{suitStrings[card % 4]} </td>;
        });

        const playerCards = this.state.playerHand.map(function(card,i){
            return <td align="center" border="20px" key={i}> {rankStrings[card % 13]}{suitStrings[card % 4]} </td>;
        });

        const playHand = this.state.playerHand.length > 0;
        if (this.state.handScore > 21) {var handStatus = " - Busted!";}
        if (this.state.dealerScore > 21) {var dealerStatus = " - Busted!";}
        let dealerScore;
        let playerScore;
        let playerBet;
        if (playHand) {
            dealerScore = <td><i>Dealer Score: {this.state.dealerScore}<b>{dealerStatus}</b></i></td>;
            playerScore = <td><i>Hand Score: {this.state.handScore}<b>{handStatus}</b>&nbsp;&nbsp;&nbsp;&nbsp;</i></td>;
            playerBet = <td><i>Bet: {parseInt(this.state.bet) /*+ parseInt(this.state.doubleDownBet)*/} wei&nbsp;&nbsp;&nbsp;&nbsp;</i></td>;
        }

        return (
                <div className="App">
                <h1>Blackjack dApp Project</h1>

                <br/>
                <p>{this.state.gameMessage}</p>

            Your deposit: <input value={this.state.setDeposit} onChange={this.onChangeDep}/> wei &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                {newGameButton}

                <br/><br/>

                <table align="center"><tbody><tr><td width="400px">
                    <h3>Dealer:</h3>
                    <table align="center" style={{'fontSize': "24px"}}><tbody><tr>{dealerCards}</tr></tbody></table>
                    <table align="center"><tbody><tr>{dealerScore}</tr></tbody></table></td>

                    <td width="400px"><h3>Your Cards:</h3>
                    <table align="center" style={{'fontSize': "24px"}}><tbody><tr>{playerCards}</tr></tbody></table>
                    <table align="center"><tbody><tr>{playerScore}{playerBet}</tr></tbody></table></td>
                </tr></tbody></table>
            {standButton}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            {hitButton}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;

                <br/>
            {cashOutButton}
                <br/>

            Place your bet: <input value={this.state.betValue} onChange={this.onChange}/> wei &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                {dealButton}
                <br/>
                <div> Maximum bet: {this.state.safeBalance} wei</div>
                <br/>
                <i>(connected account: {this.state.playerAccount})</i>

                <p/><hr style={{height: 2}}/>

                <p>{String.fromCharCode(9830)} Blackjack Pays 3:2 {String.fromCharCode(9827)} Dealer Stands on Soft 17 {String.fromCharCode(9829)}</p>
            </div>
        );
    }
}

export default App;
