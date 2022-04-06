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

let escrow = ""
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

var sk_to_mnemonic = "work matter income zebra rib assault cute beauty half praise glad teach burden midnight please piano summer absent muffin say race one trick above sense"; 
var selling_account = algosdk.mnemonicToSecretKey(sk_to_mnemonic); 


console.log("\nPublic Selling Address is: " + selling_account.addr);

// receive a mqtt message
client.on('message', function (topic, message){
    let msg = JSON.parse(message)
    console.log("Received message from topic: " + topic)
    atomicIoTDataExchange(msg.data.Humidity);
});

fs.readFile('./contract/example_sc.teal', 'utf8', (err, data) => {
    if (err) throw err;
    util.compileProgram(algodclient, data).then(async (program) => {
        escrow = algosdk.makeLogicSig(program);
        console.log(escrow.address())
    });
});

async function atomicIoTDataExchange(msg) {
    try{
        let accountInfo = await algodclient.accountInformation(selling_account.addr).do();
        console.log("Account balance: %d microAlgos", accountInfo.amount);
        

        let params = await algodclient.getTransactionParams().do();
        let note = util.createUIntForContract(parseInt(msg));


        // setting up transaction record fields
        let txn1 = algosdk.makePaymentTxnWithSuggestedParams(selling_account.addr, escrow.address(), 0, undefined, note, params);
        // setting up transaction record fields
        let txn2 = algosdk.makePaymentTxnWithSuggestedParams(escrow.address(), selling_account.addr, 1000, undefined, undefined, params)
        // Store both transactions
        let txns = [txn1, txn2];

        // Group both transactions
        let txgroup = algosdk.assignGroupID(txns);

        // Sign each transaction in the group with
        // correct key
        let signed = []
        signed.push( txn1.signTxn( selling_account.sk ) )
        signed.push( algosdk.signLogicSigTransactionObject(txn2, escrow).blob )

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