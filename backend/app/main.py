"""FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import auth, progress, quotes, screeners, stocks, trades, transactions, watchlist

app = FastAPI(
    title=settings.app_name,
    description="AlphaNote - Quantitative Investment Research API",
    version="1.0.0",
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins (nginx handles the actual access control)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(stocks.router, prefix="/api/stocks", tags=["Stocks"])
app.include_router(quotes.router, prefix="/api/stocks", tags=["Quotes"])
app.include_router(transactions.router, prefix="/api", tags=["Transactions"])
app.include_router(trades.router, prefix="/api/trades", tags=["Trades"])
app.include_router(watchlist.router, prefix="/api/watchlist", tags=["Watchlist"])
app.include_router(screeners.router, prefix="/api", tags=["Screeners"])
app.include_router(progress.router, prefix="/api", tags=["Progress"])


@app.get("/")
def root():
    """Root endpoint."""
    return {"message": "Welcome to AlphaNote API", "version": "1.0.0"}


@app.get("/health")
@app.get("/api/health")
def health():
    """Health check endpoint."""
    return {"status": "healthy"}
