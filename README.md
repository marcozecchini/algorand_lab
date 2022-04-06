# Algorand

* Blockchain trilemma? https://hackernoon.com/examining-the-blockchain-trilemma-from-algorands-prism-2kcb32qd
* What is Algorand?  https://developer.algorand.org/docs/algorand_consensus/

### 1 Transactions 

We will see how to send a transaction with Algorand. More information from this [page](https://developer.algorand.org/docs/build-apps/hello_world/).

Use [PureStake](https://www.purestake.com/) to connect to the Algorand Testnet network. Otherwise you can build your own node using Algorand [sandbox](https://github.com/algorand/sandbox). 

To charge your account with money go to: https://bank.testnet.algorand.network/

### 2 Exchanging data with money on Algorand

We will see how to exchange data with Algos (Algorand cryptocurrecy). In order to do so we will use [Atomic Transfer](https://developer.algorand.org/docs/features/atomic_transfers/), an Algorand tool, where a group of transactions are submitted as a unit and all transactions in the batch either pass or fail.

### 3 Exchanging data with money on Algorand with a Smart Contract

In this example (see folder `sc-algorand-example`) we will exchange data for Algos like in the previous case. However, in this example the seller won't interact with another user but with a programmable smart contract.

### 4 Stateful Smart Contract and an auction example
In this example (see folder `stateful-auction`) we will see how to develop a stateful contract and how to create tokens and realize an auction using these two tools.

### 5 Algorand real use case scenario

* https://www.algorand.com/resources/news/planetwatch-environmental-usecase
* [Planet Watch](https://www.youtube.com/watch?v=ZRpGM2LutZ4)