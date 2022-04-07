from ensurepip import version
from pyteal import *


def approval_program():
    on_creation = Seq([
        App.globalPut(Bytes("Auctioneer"), Txn.sender()),
        Assert(Txn.application_args.length() == Int(1)),
        # Assert(Txn.application_args[3] == Txn.sender()),
        # Assert(Txn.sender() == Txn.application_args[3]),
        App.globalPut(Bytes("AuctionBegin"), Global.latest_timestamp()),
        App.globalPut(Bytes("AuctionEnd"), Global.latest_timestamp() + Int(90)),
        App.globalPut(Bytes("AuctionedToken"), Btoi(Txn.application_args[0])),  # 1 byte
        App.globalPut(Bytes("MaxBid"), Int(0)),  # or base
        App.globalPut(Bytes("MaxBidder"), Bytes("NONE")),
        Return(Int(1))
    ])

    is_creator = Gtxn[0].sender() == App.globalGet(Bytes("Auctioneer"))

    on_update = Seq([
        Assert(is_creator),
        Assert(Global.group_size() == Int(1)),
        Assert(Txn.application_args.length() == Int(2)),
        App.globalPut(Bytes("EscrowContract"), Txn.application_args[1]),
        Return(Int(1))
    ])

    # get_bid_of_sender = App.globalGetEx(App.id(), Gtxn[0].sender())

    max_bid = App.globalGet(Bytes("MaxBid"))
    max_bidder = App.globalGet(Bytes("MaxBidder"))
    escrow_contract = App.globalGet(Bytes("EscrowContract"))
    auctioned_token = App.globalGet(Bytes("AuctionedToken"))
    auctioneer = App.globalGet(Bytes("Auctioneer"))

    on_bid = Seq([
        If(max_bid == Int(0), Assert(Global.group_size() == Int(2)),
           Assert(
               And(Global.group_size() == Int(3),
                   Gtxn[2].receiver() == max_bidder,
                   Gtxn[2].sender() == escrow_contract,
                   Gtxn[2].amount() == max_bid))),
        Assert(
            And(Global.latest_timestamp() >= App.globalGet(Bytes("AuctionBegin")),
                # Check whether it is in the right interval time
                Global.latest_timestamp() <= App.globalGet(Bytes("AuctionEnd")),
                Gtxn[1].amount() > max_bid,
                Gtxn[0].application_args.length() == Int(2),
                Gtxn[0].sender() == Gtxn[1].sender(),
                Gtxn[1].receiver() == escrow_contract
                ),
        ),

        App.globalPut(Bytes("MaxBidder"), Gtxn[1].sender()),
        App.globalPut(Bytes("MaxBid"), Gtxn[1].amount()),
        Return(Int(1))
    ])

    on_finish = Seq([

        Assert(And(
            Global.latest_timestamp() >= App.globalGet(Bytes("AuctionEnd")),
            Global.group_size() == Int(3),
            Gtxn[1].type_enum() == Int(4),
            Gtxn[2].amount() == max_bid,
            Gtxn[0].sender() == max_bidder,
            Gtxn[2].receiver() == auctioneer,
            Gtxn[1].sender() == Gtxn[2].sender(),
            Gtxn[1].sender() == escrow_contract,
        )),
        Return(Int(1))
    ])

    program = Cond(
        [Txn.application_id() == Int(0), on_creation],
        [Gtxn[0].on_completion() == OnComplete.DeleteApplication, Return(is_creator)],
        [Gtxn[0].on_completion() == OnComplete.UpdateApplication, Return(is_creator)],
        [Gtxn[0].on_completion() == OnComplete.CloseOut, Return(is_creator)],
        [Gtxn[0].on_completion() == OnComplete.OptIn, Return(is_creator)],
        [Gtxn[0].application_args[0] == Bytes("bid"), on_bid],
        [Gtxn[0].application_args[0] == Bytes("escrow"), on_update],
        [Gtxn[0].application_args[0] == Bytes("finish"), on_finish]
    )
    return program


def clear_state_program():
    is_creator = Txn.sender() == App.globalGet(Bytes("Creator"))
    program = Return(is_creator)

    return program


if __name__ == "__main__":
    with open('./clear_text_stateful.teal', 'w') as f:
        compiled = compileTeal(approval_program(), Mode.Application, version=4)
        f.write(compiled)

    with open('./clear_text_clear_state.teal', 'w') as f:
        compiled = compileTeal(clear_state_program(), Mode.Application,version=4)
        f.write(compiled)
