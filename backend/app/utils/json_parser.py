import json
import re
import logging
from typing import Any, Dict

logger = logging.getLogger(__name__)

def parse_robust_json(text: str) -> Any:
    """
    Attempts to parse a string into a JSON object, handling common LLM hallucinations
    like markdown wrappers and truncated outputs.
    """
    text = text.strip()
    
    # Clean markdown wrappers
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
        
    if text.endswith("```"):
        text = text[:-3]
        
    text = text.strip()

    # Fast path: try standard parsing first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try to extract just the JSON object or array
    match = re.search(r'(\{.*\}|\[.*\])', text, re.DOTALL)
    if match:
        extracted = match.group(1).strip()
        try:
            return json.loads(extracted)
        except json.JSONDecodeError:
            text = extracted # Use extracted for further fixing

    # Fallback fixes for truncated JSON
    if "{" in text and "}" not in text:
        text += "}"
    if "[" in text and "]" not in text:
        text += "]"
        
    # Sometimes LLMs trail with commas before closing bracket
    text = re.sub(r',\s*\}', '}', text)
    text = re.sub(r',\s*\]', ']', text)

    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON robustly: {e}. Raw text: {text}")
        raise ValueError("Invalid JSON output from LLM") from e
