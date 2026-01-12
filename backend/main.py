"""Entry point for the FastAPI application."""

from app.main import app

# This allows running with: gunicorn main:app
# or: uvicorn main:app --reload
