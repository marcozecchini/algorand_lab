const algosdk = require('algosdk');
const util = require('./util');
const mqtt = require ('mqtt');
const fs = require('fs');

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
const postHeader = {    
    'content-type' : 'application/x-binary'
}

//instantiate the algod wrapper
let algodclient = new algosdk.Algodv2(token, baseServer, port); 

//Create an account or ...

// var selling_account = algosdk.generateAccount();
// var selling_mnemonic = algosdk.secretKeyToMnemonic(selling_account.sk);
// console.log("Selling Mnemonic is: " + selling_mnemonic);


// var consumer_account = algosdk.generateAccount();
// var consumer_mnemonic = algosdk.secretKeyToMnemonic(consumer_account.sk);
// console.log("\nConsumer Mnemonic is: " + consumer_mnemonic);

// ... recover the account 
var sk_to_mnemonic = "custom casino carpet correct carry virtual dish vanish eagle police witness because point fresh security grant impact woman include door left stumble opinion abstract glass"; 
var consumer_account = algosdk.mnemonicToSecretKey(sk_to_mnemonic); 

var sk_to_mnemonic = "diagram nasty clerk net battle artist insect easily mechanic control tomato level bulk canyon embrace try office feature real payment sail sibling spare abstract dune"; 
var selling_account = algosdk.mnemonicToSecretKey(sk_to_mnemonic); 


console.log("\nPublic Selling Address is: " + selling_account.addr);
console.log("\nPublic Consumer Address is: " + consumer_account.addr);

// receive a mqtt message
client.on('message', function (topic, message){
    console.log("Received message from topic: " + topic)
    atomicIoTDataExchange(message);
});
    

async function atomicIoTDataExchange(msg) {
    try{
        let accountInfo = await algodclient.accountInformation(selling_account.addr).do();
        console.log("Account balance: %d microAlgos", accountInfo.amount);
        
        accountInfo = await algodclient.accountInformation(consumer_account.addr).do();
        console.log("Account balance: %d microAlgos", accountInfo.amount);//Get the relevant params from the algod

        let params = await algodclient.getTransactionParams().do();
        let note = algosdk.encodeObj(msg);


        // setting up transaction record fields
        let txn1 = algosdk.makePaymentTxnWithSuggestedParams(selling_account.addr, consumer_account.addr, 0, undefined, note, params);
        // setting up transaction record fields
        let txn2 = algosdk.makePaymentTxnWithSuggestedParams(consumer_account.addr, selling_account.addr, 1000, undefined, undefined, params)
        // Store both transactions
        let txns = [txn1, txn2];

        // Group both transactions
        let txgroup = algosdk.assignGroupID(txns);

        // Sign each transaction in the group with
        // correct key
        let signed = []
        signed.push( txn1.signTxn( selling_account.sk ) )
        signed.push( txn2.signTxn( consumer_account.sk ) )

        let tx = (await algodclient.sendRawTransaction(signed).do());
        console.log("Transaction : " + tx.txId);

        // Wait for transaction to be confirmed
        let confirmedTxn = await util.waitForConfirmation(algodclient, tx.txId, 4)

        //Get the completed Transaction
        console.log("Transaction " + tx.txId + " confirmed in round " + confirmedTxn["confirmed-round"]);

    } catch (e) {
        console.log(e);
    }
}