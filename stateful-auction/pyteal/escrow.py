from pyteal import *
import sys


def escrow_program(auctioneer_addr, asset_id, app_id):
    auctioneer = Addr(auctioneer_addr)
    auctioned_asset = Int(asset_id)
    application = Int(app_id)

    auction_starts = And(
        Txn.type_enum() == TxnType.AssetTransfer,
        Txn.asset_amount() == Int(0),
        Txn.xfer_asset() == auctioned_asset,
    )

    bid_transfer = And(
        Global.group_size() == Int(3),
        Gtxn[0].application_id() == application,
        Gtxn[0].close_remainder_to() == Global.zero_address(),
        Gtxn[1].close_remainder_to() == Global.zero_address(),
        Gtxn[2].close_remainder_to() == Global.zero_address()
    )

    finish_auction = And(
        Global.group_size() == Int(3),
        Gtxn[1].xfer_asset() == auctioned_asset,
        Gtxn[2].receiver() == auctioneer,
        Gtxn[0].application_id() == application,
    )

    program = If(Global.group_size() == Int(1), auction_starts, Or(bid_transfer, finish_auction))

    return program


if __name__ == "__main__":
    with open('./pyteal/escrow_conf.teal', 'w') as f:
        compiled = compileTeal(escrow_program(sys.argv[1], int(sys.argv[2]), int(sys.argv[3])), Mode.Signature)
        f.write(compiled)
        print("COMPLETED")
        sys.stdout.flush()
