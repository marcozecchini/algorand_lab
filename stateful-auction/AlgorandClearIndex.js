const EventEmitter = require('events')
const event = new EventEmitter();

const ac = require('./algorand_implementations/ClearAuctioneer')
const bp = require('./algorand_implementations/ClearBidderPool')

const bidderPool = new bp(event);
const auctioneer = new ac(event);


auctioneer.startAuction();