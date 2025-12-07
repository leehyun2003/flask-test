import requests
import os
import sqlite3
import json # JSON 데이터 대신 db_init.py에서 로드하기 위해 필요
from flask import Flask, render_template, request, jsonify, g # g는 요청별 데이터 저장에 사용
from openai import OpenAI 

# OpenAI 클라이언트 초기화
client = OpenAI(api_key="YOUR_API_KEY") 

app = Flask(__name__)
DATABASE = 'smart_recycle.db'

# --------------------
# ✅ DB 연결 관리 함수 (sqlite3)
# --------------------

def get_db():
    # 요청 컨텍스트(g)에 DB 연결이 없으면 새로 생성합니다.
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        # 딕셔너리 형태로 결과를 반환하도록 설정
        db.row_factory = sqlite3.Row 
    return db

@app.teardown_appcontext
def close_connection(exception):
    # 요청 처리가 끝나면 DB 연결을 닫습니다.
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()


# --------------------
# ✅ 엔드포인트 정의
# --------------------

@app.route("/")
def index():
    return "안녕하세요, 스마트 분리수거 앱 Flask 서버가 실행 중입니다. /final 로 접속하세요."

@app.route("/final")
def final():
    """메인 스마트 분리수거 페이지 렌더링"""
    return render_template("final.html", title="♻️ 스마트 분리수거")

# --------------------
# ✅ 기능 1: 위치 기반 정보 (Reverse Geocoding) - 기존 코드 유지
# --------------------
@app.post("/reverse-geocode")
def reverse_geocode():
    data = request.get_json()
    lat = data.get("latitude")
    lon = data.get("longitude")
    # ... (기존 Reverse Geocoding 로직 유지) ...
    url = f"https://nominatim.openstreetmap.org/reverse"
    params = {
        "lat": lat,
        "lon": lon,
        "format": "json",
        "addressdetails": 1
    }

    try:
        response = requests.get(url, params=params, headers={"User-Agent": "flask-smart-recycle-app"})
        response.raise_for_status()
        return jsonify(response.json())
    except Exception as e:
        print("❌ Reverse Geocoding 오류:", e)
        return jsonify({"error": str(e)}), 500


# --------------------
# ✅ 기능 1 & 2: DB에서 정보 조회하는 새로운 엔드포인트 (Pure SQL)
# --------------------
@app.post("/get-recycle-info")
def get_recycle_info():
    """main.js에서 받은 지역명과 가이드 정보를 DB에서 조회하여 반환"""
    data = request.get_json()
    city = data.get("city")
    district_key = data.get("districtKey")
    
    db = get_db()
    cursor = db.cursor()
    info = None
    
    try:
        # 1. 지역별 분리수거 기본 정보 조회 (CITY_DISTRICT)
        # SQLite에서 LIKE 연산자를 사용하여 부분 일치 및 대소문자 구분 없이 검색
        cursor.execute("""
            SELECT district_id, discharge_time
            FROM city_district
            WHERE city_name = ? AND district_name LIKE ?
            LIMIT 1
        """, (city, f'%{district_key}%'))
        
        district_data = cursor.fetchone()
        
        if district_data:
            district_id = district_data['district_id']
            info = {"배출시간": district_data['discharge_time']}
            
            # 2. 지역별 상세 정보 조회 (RECYCLE_DETAIL)
            cursor.execute("""
                SELECT info_type, item_name, info_value
                FROM recycle_detail
                WHERE district_id = ?
            """, (district_id,))
            
            details = cursor.fetchall()
            
            recycle_items = {}
            bag_colors = {}
            
            for detail in details:
                if detail['info_type'] == "재활용품":
                    recycle_items[detail['item_name']] = detail['info_value']
                elif detail['info_type'] == "봉투색상":
                    bag_colors[detail['item_name']] = detail['info_value']
            
            info["재활용품"] = recycle_items
            info["봉투색상"] = bag_colors

        # 3. 가이드 정보 전체 조회 (GUIDE_CATEGORY, GUIDE_ITEM)
        categories_list = []
        
        cursor.execute("SELECT category_id, name, icon FROM guide_category ORDER BY category_id")
        categories_query = cursor.fetchall()
        
        for cat in categories_query:
            category_id = cat['category_id']
            items_list = []
            
            cursor.execute("""
                SELECT name, description 
                FROM guide_item 
                WHERE category_id = ? 
                ORDER BY item_id
            """, (category_id,))
            item_query = cursor.fetchall()
            
            for item in item_query:
                items_list.append({
                    "name": item['name'],
                    "description": item['description']
                })
            
            categories_list.append({
                "name": cat['name'],
                "icon": cat['icon'],
                "items": items_list
            })
            
        guide_data = {"categories": categories_list}

        return jsonify({
            "location_info": info,
            "guide_data": guide_data,
            "status": "success"
        })

    except Exception as e:
        print("❌ DB 조회 중 오류:", e)
        return jsonify({"error": f"데이터베이스 조회 중 오류가 발생했습니다: {str(e)}"}), 500


# --------------------
# ✅ 기능 3: 챗봇 이미지 분석 (OpenAI Vision API) - 기존 코드 유지
# --------------------
@app.post("/chatbot-analyze-image")
def chatbot_analyze_image():
    # ... (기존 chatbot_analyze_image 함수 코드 유지) ...
    data = request.get_json()
    image_data_url = data.get("image_data_url")

    if not image_data_url:
        return jsonify({"error": "이미지 데이터가 없습니다."}), 400

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
        return jsonify({
            "response": chatbot_response,
            "status": "success"
        })

    except Exception as e:
        print("❌ OpenAI API 호출 중 오류:", e)
        return jsonify({"error": f"챗봇 API 호출 중 오류가 발생했습니다: {str(e)}"}), 500

if __name__ == "__main__":
    # DB 초기화 및 데이터 삽입을 위해 db_init.py 호출
    from static.data.db_init import init_db_with_data 
    with app.app_context():
        # 서버 시작 시 테이블 생성 및 데이터 삽입 (개발 환경용)
        init_db_with_data() 
    app.run(debug=True)
