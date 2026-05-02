#!/usr/bin/env python3
"""
generates Fernet key for ENCRYPTION_KEY in .env

Usage:
    python scripts/generate_key.py
"""
from cryptography.fernet import Fernet

key = Fernet.generate_key().decode()
print("Generated ENCRYPTION_KEY:")
print(key)
print("\nAdd this to your .env file:")
print(f"ENCRYPTION_KEY={key}")