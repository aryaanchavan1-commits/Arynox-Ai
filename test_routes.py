import json
import requests

BASE = "http://127.0.0.1:3100"
out = []

try:
    r = requests.post(f"{BASE}/api/chat", json={
        "messages": [{"role": "user", "content": "नमस्ते स्टारी, मेरा नाम आर्यन है और मुझे कॉफी पसंद है"}],
        "memory": [],
    }, timeout=120)
    body = r.json()
    out.append(f"CHAT-HI status={r.status_code}: reply={body.get('reply')} lang={body.get('lang')} model={body.get('model')} autoMemory={body.get('memory')}")
except Exception as e:
    out.append(f"CHAT-HI EXC: {e}")

try:
    r = requests.post(f"{BASE}/api/chat", json={
        "messages": [
            {"role": "user", "content": "नमस्ते स्टारी, मेरा नाम आर्यन है और मुझे कॉफी पसंद है"},
            {"role": "assistant", "content": "नमस्ते आर्यन! आपसे मिलकर अच्छा लगा। मुझे याद रहेगा कि आपको कॉफी पसंद है।"},
            {"role": "user", "content": "मेरा नाम क्या है?"},
        ],
        "memory": ["User's name is Aryan", "User likes coffee"],
    }, timeout=120)
    body = r.json()
    out.append(f"CHAT-MEM status={r.status_code}: reply={body.get('reply')} model={body.get('model')}")
except Exception as e:
    out.append(f"CHAT-MEM EXC: {e}")

try:
    r = requests.post(f"{BASE}/api/chat", json={
        "messages": [{"role": "user", "content": "Hello Stary, greet me in English"}],
        "memory": [],
    }, timeout=120)
    body = r.json()
    out.append(f"CHAT-EN status={r.status_code}: reply={body.get('reply')} model={body.get('model')}")
except Exception as e:
    out.append(f"CHAT-EN EXC: {e}")

for lang in ["en", "hi", "mr"]:
    try:
        r = requests.post(f"{BASE}/api/tts", json={"text": "Hello, this is Stary speaking", "lang": lang}, timeout=90)
        out.append(f"TTS-{lang} status={r.status_code} type={r.headers.get('content-type')} bytes={len(r.content)}")
    except Exception as e:
        out.append(f"TTS-{lang} EXC: {e}")

try:
    with open("test_hi.mp3", "rb") as f:
        r = requests.post(f"{BASE}/api/stt", files={"audio": ("voice.mp3", f, "audio/mpeg")}, timeout=90)
        body = r.json()
        out.append(f"STT status={r.status_code}: text={body.get('text')} lang={body.get('lang')}")
except Exception as e:
    out.append(f"STT EXC: {e}")

open("web_test.txt", "w", encoding="utf-8").write("\n".join(out))
print("done")
