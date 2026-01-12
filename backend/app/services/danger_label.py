"""DANGER label logic."""

from app.models.stock import StockBasic


def get_danger_reasons(stock: StockBasic) -> list[str]:
    """
    Returns list of reasons why a stock should show DANGER label.

    Conditions:
    - ROE < 5%
    - Consecutive loss >= 3 years
    - Is in blacklist
    """
    reasons = []

    if stock.roe is not None and stock.roe < 5:
        reasons.append(f"ROE低于5% (当前: {stock.roe:.1f}%)")

    if stock.consecutive_loss_years >= 3:
        reasons.append(f"连续亏损{stock.consecutive_loss_years}年")

    if stock.is_blacklisted:
        reasons.append("已加入黑名单")

    return reasons
