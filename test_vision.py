import base64
import io
import json
import requests

img_res = requests.get("https://image.pollinations.ai/prompt/a%20red%20apple%20on%20a%20wooden%20table", timeout=120)
print("pollinations fetch:", img_res.status_code, len(img_res.content))
if img_res.ok:
    data_url = "data:image/jpeg;base64," + base64.b64encode(img_res.content).decode()
    r = requests.post("http://127.0.0.1:3100/api/chat", json={
        "messages": [{"role": "user", "content": "What do you see in this image? Describe it briefly."}],
        "memory": [],
        "image": data_url,
    }, timeout=150)
    body = r.json()
    print("VISION status:", r.status_code)
    print("VISION reply:", (body.get("reply") or body.get("error"))[:300])
    print("VISION model:", body.get("model"))
