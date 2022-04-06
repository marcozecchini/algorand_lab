const algosdk = require('algosdk');

const env = require("../environment.js");
const utils = require('./utils');

module.exports = function (algodClient, i) {
    let account = algosdk.mnemonicToSecretKey(env.bidder[i]);
    let assetID = 0;
    let appID = 0;
    let escrow = '';
    let auctioneer = undefined;


    this.sendBid = async function (assetId, appId, escrow_v, auctioneer_v) {
        // let bid = Math.floor(( Math.random() * 10 ) * 1000);
        let bid = Math.floor( (i + 1) * 1000);
        appID = appId;
        escrow = escrow_v;
        assetID = assetId;
        auctioneer = auctioneer_v;
        try {
            let variables = await utils.readGlobalState(algodClient, auctioneer, appID);
            await sendGroupBid(bid, variables);
        } catch (e) {
            console.log(e);
        }

    }

    async function sendGroupBid(bid, variables) {
        // get suggested prams from the network
        let params = await algodClient.getTransactionParams().do();
        params.fee = 1000;
        params.flatFee = true;

        let AppArgs = [];
        AppArgs.push(new Uint8Array(Buffer.from("bid")));
        AppArgs.push(algosdk.decodeAddress(account.addr).publicKey);

        if(parseInt(variables['MaxBid']) > 0) {
            // Create transaction to stateful contract
            let transaction1 = algosdk.makeApplicationNoOpTxn(account.addr, params, appID, AppArgs );
            // Create transaction A to escrow
            let transaction2 = algosdk.makePaymentTxnWithSuggestedParams(account.addr, escrow.address(), bid, undefined, undefined, params);
            // Create transaction to fulfill previous max bid
            let transaction3 = algosdk.makePaymentTxnWithSuggestedParams(escrow.address(), variables['MaxBidder'], variables['MaxBid'], undefined, undefined, params);

            // Store both transactions
            let txns = [transaction1, transaction2, transaction3];

            // Group both transactions
            let txgroup = algosdk.assignGroupID(txns);

            // Sign each transaction in the group
            let signedTx1 = algosdk.signTransaction(transaction1, account.sk)
            let signedTx2 = algosdk.signTransaction(transaction2, account.sk)
            let signedTx3 = algosdk.signLogicSigTransactionObject(transaction3, escrow);

            // Combine the signed transactions
            let signed = []
            signed.push( signedTx1.blob )
            signed.push( signedTx2.blob )
            signed.push( signedTx3.blob )


            let tx = (await algodClient.sendRawTransaction(signed).do());
            console.log("BID",i, "- Transaction : " + tx.txId);

            // Wait for transaction to be confirmed
            await utils.waitForConfirmation(algodClient, tx.txId);

        } else {
            // Create transaction to stateful contract
            let transaction1 = algosdk.makeApplicationNoOpTxn(account.addr, params, appID, AppArgs, );
            // Create transaction A to escrow
            let transaction2 = algosdk.makePaymentTxnWithSuggestedParams(account.addr, escrow.address(), bid, undefined, undefined, params);

            // Store both transactions
            let txns = [transaction1, transaction2];

            // Group both transactions
            let txgroup = algosdk.assignGroupID(txns);

            // Sign each transaction in the group
            // let signedTx1 = transaction1.signTxn( account.sk )
            let signedTx1 = algosdk.signTransaction(transaction1, account.sk)
            let signedTx2 = algosdk.signTransaction(transaction2, account.sk)

            // Combine the signed transactions
            let signed = []
            signed.push( signedTx1.blob )
            signed.push( signedTx2.blob )

            let tx = (await algodClient.sendRawTransaction(signed).do());
            console.log("BID", i, "- Transaction : " + tx.txId);

            // Wait for transaction to be confirmed
            await utils.waitForConfirmation(algodClient, tx.txId);
        }
        let txOpt = algosdk.makeAssetTransferTxnWithSuggestedParams(account.addr, account.addr, undefined, undefined, 0, undefined, assetID, params)
        let signedRawTxn = algosdk.signTransaction(txOpt, account.sk)
        let send_tx = algodClient.sendRawTransaction(signedRawTxn.blob).do();

    }

    this.finishAuction = async function () {
        try {
            let variables = await utils.readGlobalState(algodClient, auctioneer, appID);
            let params = await algodClient.getTransactionParams().do();
            // comment out the next two lines to use suggested fee
            params.fee = 1000;
            params.flatFee = true;

            let args = []
            args.push(new Uint8Array(Buffer.from('finish')));
            args.push(algosdk.decodeAddress(variables['MaxBidder']).publicKey);


            // Create transaction to stateful contract
            let transaction1 = algosdk.makeApplicationNoOpTxn(account.addr, params, appID, args);
            // Create transaction A to escrow
            let transaction2 = algosdk.makeAssetTransferTxnWithSuggestedParams(escrow.address(), variables['MaxBidder'], undefined, undefined, 1, undefined, assetID, params)
            // Create transaction to fulfill previous max bid
            let transaction3 = algosdk.makePaymentTxnWithSuggestedParams(escrow.address(), variables['Auctioneer'], variables['MaxBid'], undefined, undefined, params);

            // Store both transactions
            let txns = [transaction1, transaction2, transaction3];

            // Group both transactions
            let txgroup = algosdk.assignGroupID(txns);

            // Sign each transaction in the group
            let signedTx1 = algosdk.signTransaction(transaction1, account.sk)
            let signedTx2 = algosdk.signLogicSigTransactionObject(transaction2, escrow)
            let signedTx3 = algosdk.signLogicSigTransactionObject(transaction3, escrow);

            // Combine the signed transactions
            let signed = []
            signed.push(signedTx1.blob)
            signed.push(signedTx2.blob)
            signed.push(signedTx3.blob)


            let tx = (await algodClient.sendRawTransaction(signed).do());
            console.log("FINISH - Transaction : " + tx.txId);

            // Wait for transaction to be confirmed
            await utils.waitForConfirmation(algodClient, tx.txId);

        } catch(e) {
            console.log(e);
        }

    }



}