import hashlib
import json

from .errors import ApiError

DURATIONS = {30, 60, 120, 180}
GENRES = {"auto", "pop", "electronic", "hiphop", "rock", "jazz", "ambient", "orchestral", "lofi"}
PURPOSES = {"song", "video", "ad", "podcast", "game", "trailer", "focus"}
MOODS = {"calm", "energetic", "romantic", "dark", "epic", "joyful"}
TEMPOS = {"auto", "slow", "medium", "fast"}
LANGS = {"ru", "kk", "en"}
LYRICS = {"auto", "custom"}
INSTRUMENTS = {"piano", "guitar", "synth", "bass", "drums", "strings"}
TAGS = {
    "atmospheric", "electronic", "synth", "no-vocal", "lofi", "calm", "soft", "energetic", "rhythm",
    "cinematic", "orchestral", "buildup", "ambient", "flowing", "memorable", "confident", "bright",
    "unobtrusive", "background", "rock",
}
PACKAGES = {
    "start": {"price": 15000, "tokens": 300},
    "creator": {"price": 35000, "tokens": 800},
    "studio": {"price": 65000, "tokens": 1600},
}
DEFAULT_DRAFT = {
    "prompt": "", "tags": [], "vocal": False, "duration": 120, "genre": "auto", "purpose": "video",
    "mood": "calm", "tempo": "auto", "instruments": [], "language": "ru", "lyricsMode": "auto", "lyrics": "", "title": "",
}


def cost_tokens(seconds: int) -> int:
    return ((int(seconds) + 29) // 30) * 5


def _as_str_list(value, allowed: set[str], limit: int) -> list[str]:
    if not isinstance(value, list):
        raise ApiError("error.settings", 400)
    seen = []
    for item in value:
        if not isinstance(item, str) or item not in allowed or item in seen:
            continue
        seen.append(item)
        if len(seen) > limit:
            break
    return seen


def validate_settings(raw: dict, require_prompt: bool) -> dict:
    if not isinstance(raw, dict):
        raise ApiError("error.settings", 400)
    prompt = raw.get("prompt", "")
    if not isinstance(prompt, str):
        raise ApiError("error.settings", 400)
    prompt = prompt.strip()
    if require_prompt and not prompt:
        raise ApiError("error.prompt", 400)
    if len(prompt) > 1500:
        raise ApiError("error.settings", 400)
    duration = raw.get("duration")
    if duration not in DURATIONS:
        raise ApiError("error.settings", 400)
    genre = raw.get("genre", "auto")
    purpose = raw.get("purpose", "video")
    mood = raw.get("mood", "calm")
    tempo = raw.get("tempo", "auto")
    language = raw.get("language", "ru")
    lyrics_mode = raw.get("lyricsMode", "auto")
    if genre not in GENRES or purpose not in PURPOSES or mood not in MOODS or tempo not in TEMPOS or language not in LANGS or lyrics_mode not in LYRICS:
        raise ApiError("error.settings", 400)
    lyrics = raw.get("lyrics", "")
    title = raw.get("title", "")
    if not isinstance(lyrics, str) or not isinstance(title, str) or len(lyrics) > 5000 or len(title) > 120:
        raise ApiError("error.settings", 400)
    vocal = raw.get("vocal", False)
    if not isinstance(vocal, bool):
        raise ApiError("error.settings", 400)
    return {
        "prompt": prompt, "tags": _as_str_list(raw.get("tags", []), TAGS, 24), "vocal": vocal, "duration": duration,
        "genre": genre, "purpose": purpose, "mood": mood, "tempo": tempo,
        "instruments": _as_str_list(raw.get("instruments", []), INSTRUMENTS, 12),
        "language": language, "lyricsMode": lyrics_mode, "lyrics": lyrics.strip(), "title": title.strip(),
    }


def request_hash(settings: dict, scenario: str) -> str:
    payload = json.dumps({"settings": settings, "scenario": scenario}, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode()).hexdigest()


def minor_units(tenge: int) -> int:
    return int(tenge) * 100
