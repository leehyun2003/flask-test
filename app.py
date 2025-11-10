import requests
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

# 앱의 메인 페이지를 /final 대신 / 로 설정합니다.
@app.route("/")
def index():
    return "Hello, Flask!"

@app.route("/home")
def home():
    return render_template("home.html", title="Flask 템플릿 연결")

@app.route("/hw1")
def hw1():
    return render_template("hw1.html", title="스마트 분리수거 안내")

@app.route("/final")
def final():
    return render_template("final.html", title="♻️ 스마트 분리수거")

# ✅ Nominatim 기반 Reverse Geocoding 
@app.post("/reverse-geocode")
def reverse_geocode():
    data = request.get_json()
    lat = data.get("latitude")
    lon = data.get("longitude")

    url = f"https://nominatim.openstreetmap.org/reverse"
    params = {
        "lat": lat,
        "lon": lon,
        "format": "json",
        "addressdetails": 1
    }

    try:
        # User-Agent 헤더 추가 (Nominatim 정책)
        response = requests.get(url, params=params, headers={"User-Agent": "flask-smart-recycle-app"})
        response.raise_for_status()
        return jsonify(response.json())
    except Exception as e:
        print("❌ Reverse Geocoding 오류:", e)
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)