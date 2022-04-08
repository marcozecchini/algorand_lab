const algosdk = require('algosdk');
const util = require('./util');
const mqtt = require ('mqtt');

var client  = mqtt.connect('mqtt://127.0.0.1:1883');

//connect to the broker and subscribe to topic
client.on('connect', function () {
  client.subscribe('test');
  console.log('client has subscribed successfully');
});


const baseServer = 'https://testnet-algorand.api.purestake.io/ps2';
const port = '';
const token = {
    'X-API-Key': 'F9I45UDrFb9FuoYhohD35A2Tcfq0mnZ5cTuG81x9',
}


//instantiate the algod wrapper
let algodclient = new algosdk.Algodv2(token, baseServer, port); 

//Create an account or ...

// var account = algosdk.generateAccount();
// var mnemonic = algosdk.secretKeyToMnemonic(account.sk);
// console.log("Mnemonic is: " + mnemonic);

// ... recover the account 
var sk_to_mnemonic = "work matter income zebra rib assault cute beauty half praise glad teach burden midnight please piano summer absent muffin say race one trick above sense"; 
var account = algosdk.mnemonicToSecretKey(sk_to_mnemonic); 


console.log("Public Address is: " + account.addr);

// receive a mqtt message
client.on('message', function (topic, message){
    console.log("Received message from topic: " + topic)
    sendToAlgorand(message);
});
    

async function sendToAlgorand(msg) {
    try{
        let accountInfo = await algodclient.accountInformation(account.addr).do();
        console.log("Account balance: %d microAlgos", accountInfo.amount);

        //Get the relevant params from the algod
        let params = await algodclient.getTransactionParams().do();
        let note = algosdk.encodeObj(msg);

        params.fee = 1000;
        params.flatFee = true;
        const receiver = "GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A";

        // setting up transaction record fields
        
        let txn = algosdk.makePaymentTxnWithSuggestedParams(account.addr, receiver, 10000, undefined, note, params);        


        //sign the transaction
        let signedTxn = txn.signTxn(account.sk);
        let txId = txn.txID().toString();
        console.log("Signed transaction with txID: %s", txId);

        //submit the transaction
        await algodclient.sendRawTransaction(signedTxn).do();        
        
        // Wait for confirmation
        let confirmedTxn = await util.waitForConfirmation(algodclient, txId, 4);
        //Get the completed Transaction
        console.log("Transaction " + txId + " confirmed in round " + confirmedTxn["confirmed-round"]);
        let mytxinfo = JSON.stringify(confirmedTxn.txn.txn, undefined, 2);
        console.log("Transaction information: %o", mytxinfo);
        var string = new TextDecoder().decode(confirmedTxn.txn.txn.note);
        console.log("Note field: ", string);

    } catch (e) {
        console.log(e);
    }
}