const algosdk = require('algosdk');
const fs = require('fs');

const env = require("../environment.js");
const utils = require('./utils');

module.exports = function (event) {

    const algodclient = new algosdk.Algodv2(env.token, env.baseServer, env.port);

    let account = algosdk.mnemonicToSecretKey(env.auctioneer.mnemonic);
    console.log( "My address: " + account.addr);

    let escrow = '';
    let escrowLogicSignature = undefined;
    let assetID = 14080144;
    let appID = 14080380;
    let endAuction = 0;
    let startAuction = 0;

    this.startAuction = async function (){
        // await utils.readGlobalState(algodclient, account, 14089677);
        await createAsset();
        await deployContracts();
    }

    function computeEndAuction(start, min) {
        return start + min * 300;
    }

    async function createAsset() {
        try {
            let params = await algodclient.getTransactionParams().do();
            //comment out the next two lines to use suggested fee
            params.fee = 1000;
            params.flatFee = true;
            console.log(params)

            let from = account.addr;
            let suggestedParams = params;
            let total = 1;
            let defaultFrozen = false;
            let unitName = 'CAR';
            let assetName = 'AUCTION';
            let manager = account.addr;
            let reserve = account.addr;
            let freeze = account.addr;
            let clawback = ""; // No clawback address, so the auctioneer cannot claw back the asset ownership after the asset is sold
            let url = '';
            let decimals = 0;
           

            // signing and sending "txn" allows "addr" to create an asset
            // TODO non funziona
            let txn = algosdk.makeAssetCreateTxnWithSuggestedParams(from, undefined, total, decimals, defaultFrozen, manager, reserve, freeze, clawback, unitName, assetName, undefined,undefined, params);

            let rawSignedTxn = algosdk.signTransaction(txn, account.sk);
            let tx = (await algodclient.sendRawTransaction(rawSignedTxn.blob).do());
            console.log("CREATEASSET - Transaction : " + tx.txId);
            // wait for transaction to be confirmed
            await utils.waitForConfirmation(algodclient, tx.txId);
            // Get the new asset's information from the creator account
            let ptx = await algodclient.pendingTransactionInformation(tx.txId).do();
            assetID = ptx["asset-index"];
            // console.log("AssetID = " + assetID);

            await utils.printCreatedAsset(algodclient, account.addr, assetID);
        } catch (e) {
            console.log(e);
        }


    }

    async function deployContracts() {
        let localInts = 0;
        let localBytes = 0;
        let globalInts = 4;
        let globalBytes = 4;
        try {
            // get node suggested parameters
            let params = await algodclient.getTransactionParams().do();
            // comment out the next two lines to use suggested fee
            params.fee = 1000;
            params.flatFee = true;

            // declare onComplete as NoOp
            let onComplete = algosdk.OnApplicationComplete.NoOpOC;

            //read the approval_file
            fs.readFile(env.basePath+'/pyteal/clear_text_stateful.teal', 'utf8', (err, dataApproval) => {
                if (err) throw err;
                utils.compileProgram(algodclient, dataApproval).then((approvalProgram) => {
                    fs.readFile(env.basePath + '/pyteal/clear_text_clear_state.teal', 'utf8', (err, dataClear) => {
                        if (err) throw err;
                        utils.compileProgram(algodclient, dataClear).then((clearProgram) => {
                            let appArgs = [];
                            startAuction = params.firstRound;
                            endAuction = computeEndAuction(startAuction, 3);
                            appArgs.push(algosdk.encodeObj(assetID));
                            // appArgs.push(new Uint8Array(Buffer.from(account.addr.toString())));

                            // create unsigned transaction
                            let txn = algosdk.makeApplicationCreateTxn(account.addr, params, onComplete,
                                approvalProgram, clearProgram, localInts, localBytes, globalInts, globalBytes, appArgs);
                            let txId = txn.txID().toString();

                            // Sign the transaction
                            let signedTxn = txn.signTxn(account.sk);
                            console.log("DEPLOYSTATEFULCONTRACT - Signed transaction with txID: %s", txId);

                            // Submit the transaction
                            algodclient.sendRawTransaction(signedTxn).do().then(()=>{
                                utils.waitForConfirmation(algodclient, txId).then(async ()=>{
                                    algodclient.pendingTransactionInformation(txId).do().then((transactionResponse)=>{
                                        appID = transactionResponse['application-index'];
                                        console.log("DEPLOYSTATEFULCONTRACT -Created new app-id: ",appID);
                                        deployEscrowContract(assetID, appID);
                                    })
                                });
                            }).catch((e) =>{
                                console.log(e);
                            });
                        }).catch((e) =>{
                            console.log(e);
                        });
                    });
                });
            });
        } catch (e) {
            console.log(e);
            console.trace();
        }

    }

    async function deployEscrowContract(){
        let params = await algodclient.getTransactionParams().do();
        // comment out the next two lines to use suggested fee
        params.fee = 1000;
        params.flatFee = true;

        let runPy = new Promise(function(success, nosuccess) {

            const { spawn } = require('child_process');
            const pyprog = spawn('python3', [env.basePath+'/pyteal/clear_text_escrow.py', account.addr, assetID, appID]);

            pyprog.stdout.on('data', function(data) {
                success(data);
            });

            pyprog.stderr.on('data', (data) => {
                nosuccess(data);
            });
        });

        runPy.then(async function(fromRunpy) {
            // get suggested parameters

            fs.readFile(env.basePath+'/pyteal/escrow_clear.teal', 'utf8', (err, data) => {
                if (err) throw err;
                utils.compileProgram(algodclient, data).then(async (program) => {
                    let lsig = algosdk.makeLogicSig(program);
                    escrowLogicSignature = lsig;
                    escrow = lsig.address();

                    utils.makePayTransaction(algodclient, account.addr, account.sk, lsig.address()).then(async () => {
                        let params = await algodclient.getTransactionParams().do();
                        params.fee = 1000;
                        params.flatFee = true;
                        let txn = algosdk.makeAssetTransferTxnWithSuggestedParams(escrow, escrow,
                            undefined, undefined, 0,undefined, assetID, params, undefined);
                        // Create the LogicSigTransaction with contract account LogicSig
                        let rawSignedTxn = algosdk.signLogicSigTransactionObject(txn, lsig);

                        // send raw LogicSigTransaction to network
                        let tx = (await algodclient.sendRawTransaction(rawSignedTxn.blob).do());
                        console.log("ESCROWOPTIN - Transaction : " + tx.txId);
                        await utils.waitForConfirmation(algodclient, tx.txId);


                        // transfer the asset to the escrow
                        await utils.tranferAsset(algodclient, account, escrow, assetID, 1);
                        await utils.printAssetHolding(algodclient, escrow, assetID);

                        console.log("Update escrow account address in stateful contract ...")
                        let appArgs = []
                        appArgs.push(new Uint8Array(Buffer.from('escrow')));
                        appArgs.push(algosdk.decodeAddress(escrow).publicKey);
                        await utils.callApp(algodclient, account, appID, appArgs);

                        console.log("==============NOW SEND AN EVENT TO BIDDERS=========")
                        event.emit('new_auction', assetID, appID, escrowLogicSignature, account.addr);
                        console.log("==============START TIMER TO END THE AUCTION=========")
                        setTimeout(async () => {
                            let variables = await utils.readGlobalState(algodclient, account.addr, appID);
                            event.emit('winner', variables['MaxBidder']);
                        }, 60000);

                        setTimeout(async () => {
                            await utils.deleteApp(algodclient,account, appID);
                        }, 120000);

                    }).catch(async (e) => {
                        console.log(e);
                        await utils.deleteApp(algodclient,account, appID);});
                });
            });

        }).catch((e) => {console.log(e.toString())});
    }

    // async function finishAuction() {
    //     try {
    //         let winner = algosdk.mnemonicToSecretKey(env.bidder[1]);
    //         let variables = await utils.readGlobalState(algodclient, account.addr, appID);
    //         let params = await algodclient.getTransactionParams().do();
    //         // comment out the next two lines to use suggested fee
    //         params.fee = 1000;
    //         params.flatFee = true;
    //
    //         let args = []
    //         args.push(new Uint8Array(Buffer.from('finish')));
    //         args.push(algosdk.decodeAddress(variables['MaxBidder']).publicKey);
    //
    //         // Create transaction to stateful contract
    //         let transaction1 = algosdk.makeApplicationNoOpTxn(winner.addr, params, appID, args);
    //         // Create transaction A to escrow
    //         let transaction2 = algosdk.makeAssetTransferTxnWithSuggestedParams(escrowLogicSignature.address(), variables['MaxBidder'], undefined, undefined, 1, undefined, assetID, params)
    //         // Create transaction to fulfill previous max bid
    //         let transaction3 = algosdk.makePaymentTxnWithSuggestedParams(escrowLogicSignature.address(), variables['Auctioneer'], variables['MaxBid'], undefined, undefined, params);
    //
    //         // Store both transactions
    //         let txns = [transaction1, transaction2, transaction3];
    //
    //         // Group both transactions
    //         let txgroup = algosdk.assignGroupID(txns);
    //
    //         // Sign each transaction in the group
    //         let signedTx1 = algosdk.signTransaction(transaction1, winner.sk)
    //         let signedTx2 = algosdk.signLogicSigTransactionObject(transaction2, escrowLogicSignature)
    //         let signedTx3 = algosdk.signLogicSigTransactionObject(transaction3, escrowLogicSignature);
    //
    //         // Combine the signed transactions
    //         let signed = []
    //         signed.push(signedTx1.blob)
    //         signed.push(signedTx2.blob)
    //         signed.push(signedTx3.blob)
    //
    //
    //         let tx = (await algodclient.sendRawTransaction(signed).do());
    //         console.log("FINISH - Transaction : " + tx.txId);
    //
    //         // Wait for transaction to be confirmed
    //         await utils.waitForConfirmation(algodclient, tx.txId);
    //
    //         await utils.deleteApp(algodclient, account, appID);
    //     } catch(e) {
    //         console.log(e);
    //         await utils.deleteApp(algodclient,account, appID);
    //     }
    //
    // }

    /* Function without parameters
        this.getEndPoint = function () {
        }
    */

    /* Function with parameters
        async function verifyDID (DIDdocument) {

        }
    */



}
