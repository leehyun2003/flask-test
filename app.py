import requests
import os
from flask import Flask, render_template, request, jsonify
from openai import OpenAI 

# OpenAI 라이브러리가 설치되어 있어야 합니다. (pip install openai requests)

app = Flask(__name__)

# ✅ OpenAI 클라이언트 초기화
# 보안을 위해 실제 서비스에서는 환경 변수 사용을 강력히 권장합니다.
# [START_REPLACE_YOUR_API_KEY]
client = OpenAI(api_key="YOUR_OPENAI_API_KEY") 
# [END_REPLACE_YOUR_API_KEY]


@app.route("/")
def index():
    # 최종 페이지로 리다이렉트하거나 환영 메시지를 표시할 수 있습니다.
    return "안녕하세요, 스마트 분리수거 앱 Flask 서버가 실행 중입니다. /final 로 접속하세요."

@app.route("/final")
def final():
    """메인 스마트 분리수거 페이지 렌더링"""
    return render_template("final.html", title="♻️ 스마트 분리수거")

# --------------------
# ✅ 기능 1: 위치 기반 정보 (Reverse Geocoding)
# --------------------
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


# --------------------
# ✅ 기능 3: 챗봇 이미지 분석 (OpenAI Vision API)
# --------------------
@app.post("/chatbot-analyze-image")
def chatbot_analyze_image():
    """Base64 이미지 데이터를 받아 OpenAI GPT-4o로 분석하고 분리수거 방법을 안내합니다."""
    data = request.get_json()
    image_data_url = data.get("image_data_url")

    if not image_data_url:
        return jsonify({"error": "이미지 데이터가 없습니다."}), 400

    # Base64 데이터 URL 형식은 OpenAI API에 직접 전달할 수 있습니다.
    image_url_for_api = image_data_url 

    print("✅ OpenAI Vision API 호출 시작...")

    try:
        response = client.chat.completions.create(
            model="gpt-4o", 
            messages=[
                {
                    "role": "system",
                    "content": "당신은 스마트 분리수거 챗봇입니다. 사용자가 올린 이미지 속 물품을 분석하고, 해당 물품의 정확한 분리수거 방법(씻기/분리/배출)을 **한국어**로 상세하게 안내해 주세요. 답변은 분리수거 방법만 명료하게 제공하고, 인사말이나 불필요한 서론은 생략해 주세요. 물품 인식이 어렵거나 분리수거 대상이 아닌 경우에도 간결하게 답변해 주세요."
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "이 물건을 어떻게 분리수거해야 하나요?"},
                        {
                            "type": "image_url",
                            "image_url": {"url": image_url_for_api} 
                        },
                    ],
                }
            ],
            max_tokens=500,
        )

        chatbot_response = response.choices[0].message.content
        print(f"🤖 챗봇 응답 수신 완료: {chatbot_response[:50]}...")
        
        return jsonify({
            "response": chatbot_response,
            "status": "success"
        })

    except Exception as e:
        print("❌ OpenAI API 호출 중 오류:", e)
        # API 키 오류나 라이브러리 오류 등 구체적인 에러 메시지 반환
        return jsonify({"error": f"챗봇 API 호출 중 오류가 발생했습니다: {str(e)}"}), 500

if __name__ == "__main__":
    app.run(debug=True)