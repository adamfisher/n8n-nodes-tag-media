"""
Shared utilities for metadata processing in tag scripts.
"""

import json
import sys
from typing import Any, Dict, Optional


def load_metadata(meta_path: str) -> Dict[str, Any]:
    """Load metadata from a JSON file."""
    with open(meta_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def get_value(meta: Dict[str, Any], key: str, default: Optional[Any] = None) -> Optional[Any]:
    """
    Get a value from metadata dict.
    Returns None if the key is missing, value is None, or value is empty string.
    """
    value = meta.get(key, default)
    if is_empty(value):
        return None
    return value


def is_empty(value: Any) -> bool:
    """
    Check if a value should be considered empty/undefined.
    Returns True for None, empty string, or the literal string 'undefined'.
    """
    if value is None:
        return True
    if isinstance(value, str) and (value == '' or value.strip() == '' or value == 'undefined'):
        return True
    return False


def get_int_value(meta: Dict[str, Any], key: str, default: Optional[int] = None) -> Optional[int]:
    """
    Get an integer value from metadata.
    Handles string conversion and returns None for empty/invalid values.
    """
    value = get_value(meta, key)
    if value is None:
        return default
    try:
        return int(value)
    except (ValueError, TypeError):
        return default


class ExtendedProperty:
    """Represents an extended metadata property with value and mode."""
    def __init__(self, value: str, mode: str = 'overwrite'):
        self.value = value
        self.mode = mode  # 'overwrite' or 'preserve'


def get_extended(meta: Dict[str, Any]) -> Dict[str, ExtendedProperty]:
    """
    Get extended properties from metadata.
    Returns a dict of key -> ExtendedProperty, filtering out empty values.
    Handles both old format (string values) and new format (object with value/mode).
    """
    extended = meta.get('extended', {})
    if not isinstance(extended, dict):
        return {}

    result = {}
    for key, prop in extended.items():
        if isinstance(prop, dict):
            # New format: { value: string, mode: string }
            value = prop.get('value', '')
            mode = prop.get('mode', 'overwrite')
            if not is_empty(value):
                result[key] = ExtendedProperty(str(value), mode)
        elif not is_empty(prop):
            # Old format: string value (backwards compatibility)
            result[key] = ExtendedProperty(str(prop), 'overwrite')
    return result


def error_exit(message: str) -> None:
    """Print error message to stderr and exit with code 1."""
    print(f"Error: {message}", file=sys.stderr)
    sys.exit(1)
