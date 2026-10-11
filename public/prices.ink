module prices;

state Prices: Table<u64, u64> = Table.empty();
keep total_price: u64 = sum(Prices.values());

change set_price(item: u64, price: u64)
    -> Result<Unit, String> writes(Prices)
{
    if Prices.contains(item) {
        Prices.replace(item, price);
    } else {
        Prices.insert(item, price);
    }
    return Ok(());
}

query total() -> u64 reads(total_price) {
    return total_price;
}
