import requests

for lang, text in [("en", "Hello, I am Stary"),
                   ("hi", "नमस्ते, मैं स्टारी हूँ"),
                   ("mr", "नमस्कार, ही स्टारी आहे")]:
    try:
        r = requests.post("http://127.0.0.1:3100/api/tts",
                          json={"text": text, "lang": lang}, timeout=60)
        print(f"TTS-{lang}: {r.status_code} type={r.headers.get('content-type')} bytes={len(r.content)}")
    except Exception as e:
        print(f"TTS-{lang} EXC: {e}")
