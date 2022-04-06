from pyteal import *
# NQEXN2E3LYN42FY5PMPPQXJQFN7KHP3VHQGWJK2G46AU5UHWTPLAQTQ76I

seller = Addr("NQEXN2E3LYN42FY5PMPPQXJQFN7KHP3VHQGWJK2G46AU5UHWTPLAQTQ76I")
amount = Int(1000)

def recurring_swap(tmpl_buyer=seller,
                   tmpl_amount=amount):
    
    program = And(Global.group_size() == Int(2), 
        Gtxn[0].type_enum() == Int(1), 
        Gtxn[1].type_enum() == Int(1),
        Gtxn[1].receiver() == seller,
        Gtxn[1].receiver() == Gtxn[0].sender(),
        Gtxn[1].amount() == amount,
        Btoi(Gtxn[0].note()) >= Int(1000)
        )
    
    return program


if __name__ == "__main__":
    with open('./example_sc.teal', 'w') as f:
        compiled = compileTeal(recurring_swap(), mode=Mode.Signature)
        f.write(compiled)