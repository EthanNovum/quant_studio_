"""Position calculation using Moving Average Cost method."""

from dataclasses import dataclass

from app.models.transaction import Transaction


@dataclass
class Position:
    """Position data class."""

    symbol: str
    quantity: float
    avg_cost: float
    realized_pnl: float = 0


def calculate_positions(transactions: list[Transaction]) -> dict[str, Position]:
    """
    Calculate current positions using Moving Average Cost method.

    Formula for BUY:
    new_avg_cost = (old_quantity * old_avg_cost + new_quantity * new_price)
                   / (old_quantity + new_quantity)

    SELL does not change avg_cost, only reduces quantity.
    Realized P&L = (sell_price - avg_cost) * sell_quantity

    DIVIDEND reduces cost basis.

    Args:
        transactions: List of transactions sorted by date

    Returns:
        Dictionary of symbol -> Position
    """
    positions: dict[str, Position] = {}

    # Sort transactions by date
    sorted_transactions = sorted(transactions, key=lambda x: x.date)

    for tx in sorted_transactions:
        symbol = tx.symbol

        if symbol not in positions:
            positions[symbol] = Position(
                symbol=symbol,
                quantity=0,
                avg_cost=0,
                realized_pnl=0,
            )

        pos = positions[symbol]

        if tx.action == "BUY":
            # Moving average cost calculation
            total_cost = pos.quantity * pos.avg_cost + tx.quantity * tx.price
            pos.quantity += tx.quantity
            pos.avg_cost = total_cost / pos.quantity if pos.quantity > 0 else 0

        elif tx.action == "SELL":
            # Calculate realized P&L
            if pos.quantity > 0:
                realized = (tx.price - pos.avg_cost) * tx.quantity
                pos.realized_pnl += realized
            pos.quantity -= tx.quantity
            # avg_cost remains unchanged for remaining shares

        elif tx.action == "DIVIDEND":
            # Dividend reduces cost basis (per share)
            if pos.quantity > 0:
                pos.avg_cost -= tx.price / pos.quantity

    # Filter out zero or negative positions
    return {k: v for k, v in positions.items() if v.quantity > 0}
