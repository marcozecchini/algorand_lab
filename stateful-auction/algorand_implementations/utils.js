const algosdk = require('algosdk');

const env = require("../environment.js");
module.exports.N = 2;

module.exports.waitForConfirmation = async (algodclient, txId) => {
    let response = await algodclient.status().do();
    let lastround = response["last-round"];
    while (true) {
        const pendingInfo = await algodclient.pendingTransactionInformation(txId).do();
        if (pendingInfo["confirmed-round"] !== null && pendingInfo["confirmed-round"] > 0) {
            //Got the completed Transaction
            console.log("Transaction " + txId + " confirmed in round " + pendingInfo["confirmed-round"]);
            break;
        }
        lastround++;
        await algodclient.statusAfterBlock(lastround).do();
    }
};

const waitForConfirmation = async (algodclient, txId) => {
    let response = await algodclient.status().do();
    let lastround = response["last-round"];
    while (true) {
        const pendingInfo = await algodclient.pendingTransactionInformation(txId).do();
        if (pendingInfo["confirmed-round"] !== null && pendingInfo["confirmed-round"] > 0) {
            //Got the completed Transaction
            console.log("Transaction " + txId + " confirmed in round " + pendingInfo["confirmed-round"]);
            break;
        }
        lastround++;
        await algodclient.statusAfterBlock(lastround).do();
    }
};

module.exports.printCreatedAsset = async (algodclient, account, assetid) => {

    let accountInfo = await algodclient.accountInformation(account).do();
    for (idx = 0; idx < accountInfo['created-assets'].length; idx++) {
        let scrutinizedAsset = accountInfo['created-assets'][idx];
        if (scrutinizedAsset['index'] == assetid) {
            console.log("AssetID = " + scrutinizedAsset['index']);
            let myparms = JSON.stringify(scrutinizedAsset['params'], undefined, 2);
            console.log("parms = " + myparms);
            break;
        }
    }
};

module.exports.printAssetHolding = async (algodclient, account, assetid) => {
    let accountInfo = await algodclient.accountInformation(account).do();
    for (idx = 0; idx < accountInfo['assets'].length; idx++) {
        let scrutinizedAsset = accountInfo['assets'][idx];
        if (scrutinizedAsset['asset-id'] == assetid) {
            let myassetholding = JSON.stringify(scrutinizedAsset, undefined, 2);
            console.log("assetholdinginfo = " + myassetholding);
            break;
        }
    }
};

// helper function to compile program source
module.exports.compileProgram = async (client, programSource) => {
    let encoder = new TextEncoder();
    let programBytes = encoder.encode(programSource);
    let compileResponse = await client.compile(programBytes).do();
    let compiledBytes = new Uint8Array(Buffer.from(compileResponse.result, "base64"));
    return compiledBytes;
}

// create new application
module.exports.createApp = async function(client, creatorAccount, approvalProgram, clearProgram, localInts, localBytes, globalInts, globalBytes) {
    // define sender as creator
    let sender = creatorAccount.addr;

    // declare onComplete as NoOp
    let onComplete = algosdk.OnApplicationComplete.NoOpOC;

    // get node suggested parameters
    let params = await client.getTransactionParams().do();
    // comment out the next two lines to use suggested fee
    params.fee = 1000;
    params.flatFee = true;

    // create unsigned transaction
    let txn = algosdk.makeApplicationCreateTxn(sender, params, onComplete,
        approvalProgram, clearProgram,
        localInts, localBytes, globalInts, globalBytes,);
    let txId = txn.txID().toString();

    // Sign the transaction
    let signedTxn = txn.signTxn(creatorAccount.sk);
    console.log("Signed transaction with txID: %s", txId);

    // Submit the transaction
    await client.sendRawTransaction(signedTxn).do();

    // Wait for confirmation
    await waitForConfirmation(client, txId);

    // display results
    let transactionResponse = await client.pendingTransactionInformation(txId).do();
    let appId = transactionResponse['application-index'];
    console.log("Created new app-id: ",appId);
    return appId;
}

// call application
module.exports.callApp = async function(client, account, index, appArgs) {
    // define sender
    let sender = account.addr;

    // get node suggested parameters
    let params = await client.getTransactionParams().do();
    // comment out the next two lines to use suggested fee
    params.fee = 1000;
    params.flatFee = true;

    // create unsigned transaction
    let txn = algosdk.makeApplicationNoOpTxn(sender, params, index, appArgs)
    let txId = txn.txID().toString();

    // Sign the transaction
    let signedTxn = txn.signTxn(account.sk);
    console.log("Signed transaction with txID: %s", txId);

    // Submit the transaction
    await client.sendRawTransaction(signedTxn).do();

    // Wait for confirmation
    await waitForConfirmation(client, txId);

    // display results
    let transactionResponse = await client.pendingTransactionInformation(txId).do();
    console.log("Called app-id:",transactionResponse['txn']['txn']['apid'])
    // if (transactionResponse['global-state-delta'] !== undefined ) {
    //     console.log("Global State updated:",transactionResponse['global-state-delta']);
    // }
    // if (transactionResponse['local-state-delta'] !== undefined ) {
    //     console.log("Local State updated:",transactionResponse['local-state-delta']);
    // }
}

// read global state of application
module.exports.readGlobalState = async function(client, address, index){
    let resultMap = {}
    let accountInfoResponse = await client.accountInformation(address).do();
    for (let i = 0; i < accountInfoResponse['created-apps'].length; i++) {
        if (accountInfoResponse['created-apps'][i].id == index) {
            console.log("Application's global state:");
            for (let n = 0; n < accountInfoResponse['created-apps'][i]['params']['global-state'].length; n++) {
                let temp = accountInfoResponse['created-apps'][i]['params']['global-state'][n]
                let key = Buffer.from(temp.key, 'base64').toString();
                let value = '';
                console.log(key);
                if (temp.value.type === 1) {
                    if (key === ('EscrowContract') || key === ('Auctioneer'))
                        value = algosdk.encodeAddress(Buffer.from(temp.value.bytes, 'base64'));
                    else if (key === 'MaxBidder'){
                        if ('NONE' === Buffer.from(temp.value.bytes,'base64').toString())
                            value = 'NONE';
                        else
                            value = algosdk.encodeAddress(Buffer.from(temp.value.bytes, 'base64'));

                    }
                    else
                        value = Buffer.from(temp.value.bytes,'base64').toString();

                }
                else {
                    value = temp.value.uint; // perchè ritornano degli unsigned int64

                }

                console.log(value);
                resultMap[key] = value;

            }
            return resultMap;
        }
    }
}

module.exports.readGlobalStateCommitment = async function(client, address, index){
    let resultMap = {}
    let accountInfoResponse = await client.accountInformation(address).do();
    for (let i = 0; i < accountInfoResponse['created-apps'].length; i++) {
        if (accountInfoResponse['created-apps'][i].id == index) {
            console.log("Application's global state:");
            for (let n = 0; n < accountInfoResponse['created-apps'][i]['params']['global-state'].length; n++) {
                let temp = accountInfoResponse['created-apps'][i]['params']['global-state'][n]
                let key = Buffer.from(temp.key, 'base64').toString();
                let value = '';
                if (temp.value.type === 1) {
                    if (key === ('Auctioneer'))
                        value = algosdk.encodeAddress(Buffer.from(temp.value.bytes, 'base64'));

                    else if (key === ('AuctionContract'))
                        value = Buffer.from(temp.value.bytes, 'base64').toString();
                    else {
                        key = algosdk.encodeAddress(Buffer.from(temp.key, 'base64'));
                        value = Buffer.from(temp.value.bytes, 'base64').toString();
                    }
                }
                else {
                    value = temp.value.uint; // perchè ritornano degli unsigned int64
                }
                console.log(key);
                console.log(value);
                resultMap[key] = value;

            }
            return resultMap;
        }
    }
}

module.exports.createUIntForContract= function (number) {
    let buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);

    view.setBigUint64(0, number.toString());
    // console.log(view.getBigUint64(0));
    return new Uint8Array(view.buffer);
}


module.exports.updateApp = async function(client, creatorAccount, index, approvalProgram, clearProgram) {
    // define sender as creator
    sender = creatorAccount.addr;

    // get node suggested parameters
    let params = await client.getTransactionParams().do();
    // comment out the next two lines to use suggested fee
    params.fee = 1000;
    params.flatFee = true;

    // create unsigned transaction
    let txn = algosdk.makeApplicationUpdateTxn(sender, params, index, approvalProgram, clearProgram);
    let txId = txn.txID().toString();

    // Sign the transaction
    let signedTxn = txn.signTxn(creatorAccount.sk);
    console.log("Signed transaction with txID: %s", txId);

    // Submit the transaction
    await client.sendRawTransaction(signedTxn).do();

    // Wait for confirmation
    await waitForConfirmation(client, txId);

    // display results
    let transactionResponse = await client.pendingTransactionInformation(txId).do();
    let appId = transactionResponse['txn']['txn'].apid;
    console.log("Updated app-id: ",appId);
    return appId;
}


module.exports.deleteApp = async function (client, creatorAccount, index) {
    // define sender as creator
    let sender = creatorAccount.addr;

    // get node suggested parameters
    let params = await client.getTransactionParams().do();
    // comment out the next two lines to use suggested fee
    params.fee = 1000;
    params.flatFee = true;

    // create unsigned transaction
    let txn = algosdk.makeApplicationDeleteTxn(sender, params, index);
    let txId = txn.txID().toString();

    // Sign the transaction
    let signedTxn = txn.signTxn(creatorAccount.sk);
    console.log("Signed transaction with txID: %s", txId);

    // Submit the transaction
    await client.sendRawTransaction(signedTxn).do();

    // Wait for confirmation
    await waitForConfirmation(client, txId);

    // display results
    let transactionResponse = await client.pendingTransactionInformation(txId).do();
    let appId = transactionResponse['txn']['txn'].apid;
    console.log("Deleted app-id: ",appId);
    return appId;
}

module.exports.tranferAsset = async function(algodclient, sender, recipient, assetID, amount){

    let params = await algodclient.getTransactionParams().do();
    //comment out the next two lines to use suggested fee
    params.fee = 1000;
    params.flatFee = true;

    let revocationTarget = undefined;
    let closeRemainderTo = undefined;
    let note = undefined;
    //Amount of the asset to transfer

    // signing and sending "txn" will send "amount" assets from "sender" to "recipient"
    let xtxn = algosdk.makeAssetTransferTxnWithSuggestedParams(sender.addr, recipient, closeRemainderTo, revocationTarget,
        amount,  note, assetID, params);
    // Must be signed by the account sending the asset
    let rawSignedTxn = xtxn.signTxn(sender.sk);
    let xtx = (await algodclient.sendRawTransaction(rawSignedTxn).do());
    console.log("TRANSFERASSET - Transaction : " + xtx.txId);
    // wait for transaction to be confirmed
    await waitForConfirmation(algodclient, xtx.txId);
}

module.exports.makePayTransaction = async function (algodclient, sender, sender_sk, receiver) {

    let params = await algodclient.getTransactionParams().do();
    // comment out the next two lines to use suggested fee
    params.fee = 1000;
    params.flatFee = true;

    // create a transaction

    let amount = 1000000;
    let closeToRemaninder = undefined;
    let note = undefined;
    let txn = algosdk.makePaymentTxnWithSuggestedParams(sender, receiver, amount, closeToRemaninder, note, params);

    // Create the LogicSigTransaction with contract account LogicSig
    //let rawSignedTxn = algosdk.signLogicSigTransactionObject(txn, lsig);

    let rawSignedTxn = algosdk.signTransaction(txn, sender_sk);


    // send raw LogicSigTransaction to network
    let tx = (await algodclient.sendRawTransaction(rawSignedTxn.blob).do());
    console.log("PAY -Transaction : " + tx.txId);
    await waitForConfirmation(algodclient, tx.txId);
}