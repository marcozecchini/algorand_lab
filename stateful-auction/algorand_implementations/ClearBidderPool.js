const algosdk = require('algosdk');
const fs = require('fs');

const env = require("../environment.js");
const utils = require('./utils');

const bidder = require("./ClearBidder");

module.exports = function (event) {
    const algodclient = new algosdk.Algodv2(env.token, env.baseServer, env.port);

    console.log("Start BidderPool");
    let bidderPool = [];

    for (let i = 0; i < utils.N; i++) {
        bidderPool.push(new bidder(algodclient, i));
    }

    event.on('new_auction', (assetID, appID, escrow, variables) => {
        console.log("RICEVUTO");
        bidderPool[0].sendBid(assetID, appID, escrow, variables);
        let i = 1
        let interval = setInterval(() => {
            bidderPool[i].sendBid(assetID, appID, escrow, variables);
            i += 1;
            if (i === utils.N)
                clearInterval(interval);
        }, 20000);
    });

    event.on('winner', (winner) => {
        for (let i = 0; i < utils.N; i++){
            let temp = algosdk.mnemonicToSecretKey(env.bidder[i]);
            if (winner === temp.addr){
                bidderPool[i].finishAuction()
            }
        }
    });

}