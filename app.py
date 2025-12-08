import requests
import os
import sqlite3
import json 
from flask import Flask, render_template, request, jsonify, g 
from openai import OpenAI 

# ----------------------------------------
# ✅ 환경 변수 및 API 클라이언트 초기화
# ----------------------------------------
openai_api_key = os.environ.get("OPENAI_API_KEY")
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")
GOOGLE_CSE_CX = os.environ.get("GOOGLE_CSE_CX")
GOOGLE_SEARCH_URL = "https://www.googleapis.com/customsearch/v1"

# API 키가 설정되지 않은 경우 경고/오류 처리 (강화)
if not openai_api_key:
    print("❌ 치명적 오류: OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.")
if not GOOGLE_API_KEY or not GOOGLE_CSE_CX:
    print("❌ 경고: Google Search API 키 또는 CX ID가 설정되지 않았습니다. 챗봇 출처 기능이 작동하지 않을 수 있습니다.")
    
client = OpenAI(api_key=openai_api_key) 

app = Flask(__name__)
DATABASE = 'smart_recycle.db'

# ----------------------------------------
# DB 연결 관리 함수 (sqlite3)
# ----------------------------------------

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row 
    return db

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()


# ----------------------------------------
# ✅ Google CSE 검색 함수 (RAG Context 생성)
# ----------------------------------------
def get_google_search_results(query, count=3):
    """Google Custom Search API를 호출하여 검색 결과의 제목과 URL을 반환합니다."""
    if not GOOGLE_API_KEY or not GOOGLE_CSE_CX:
        return [], "Google API 키 또는 CX ID 없음"

    params = {
        "key": GOOGLE_API_KEY,
        "cx": GOOGLE_CSE_CX,
        "q": query,
        "num": count,  # 가져올 결과 개수
    }

    try:
        response = requests.get(GOOGLE_SEARCH_URL, params=params)
        response.raise_for_status() 
        search_results = response.json()
        
        sources = []
        if 'items' in search_results:
            for result in search_results['items']:
                sources.append({
                    "title": result.get('title', '제목 없음'),
                    "url": result.get('link', '#'),
                    "snippet": result.get('snippet', '') # 스니펫은 챗봇에게 주입할 정보
                })
        return sources, None
    except requests.exceptions.HTTPError as http_err:
        error_msg = f"HTTP 오류 발생 ({response.status_code}): {response.text}"
        print(f"❌ Google CSE API HTTP 오류: {error_msg}")
        return [], error_msg
    except Exception as e:
        print(f"❌ Google CSE API 일반 오류: {e}")
        return [], str(e)


# ----------------------------------------
# ✅ 엔드포인트 정의
# ----------------------------------------

@app.route("/")
def index():
    return "안녕하세요, 스마트 분리수거 앱 Flask 서버가 실행 중입니다. /final 로 접속하세요."

@app.route("/final")
def final():
    """메인 스마트 분리수거 페이지 렌더링"""
    return render_template("final.html", title="♻️ 스마트 분리수거")

# 기능 1: 위치 기반 정보 (Reverse Geocoding)
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
        response = requests.get(url, params=params, headers={"User-Agent": "flask-smart-recycle-app"})
        response.raise_for_status()
        return jsonify(response.json())
    except Exception as e:
        print("❌ Reverse Geocoding 오류:", e)
        return jsonify({"error": str(e)}), 500


# 기능 1 & 2: DB에서 정보 조회하는 엔드포인트
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



# ----------------------------------------
# ✅ 통합된 챗봇 엔드포인트 (/chatbot-unified-chat)
# ----------------------------------------
@app.post("/chatbot-unified-chat")
def chatbot_unified_chat():
    data = request.get_json()
    user_message = data.get("message")
    image_data_url = data.get("image_data_url") # Base64 이미지 데이터 (선택 사항)
    user_location = data.get("location")       # 위치 정보 (선택 사항)

    if not user_message and not image_data_url:
        return jsonify({"error": "메시지 또는 이미지가 없습니다."}), 400
    
    # -----------------------------
    # 1. Google CSE 검색 (이미지가 없을 때만 수행 - 텍스트 질문에 대한 출처 확보)
    # -----------------------------
    search_sources = []
    sources_to_return = []
    context = ""
    
    # ✅ 수정된 조건: 이미지가 없고 메시지가 있으며, 메시지 길이가 3자 이상일 때만 검색 수행
    if not image_data_url and user_message and len(user_message) >= 3:
        print(f"✅ Google 검색 수행 (RAG)")
        search_sources, search_error = get_google_search_results(user_message, count=3)
    
        if search_sources:
            context = "다음은 웹 검색 결과입니다. 이 정보를 활용하여 답변을 작성하세요:\n\n"
            for i, source in enumerate(search_sources):
                context += f"[{i+1}] {source['snippet']}\n"
            # 출처 정보를 반환 객체에 맞게 포맷팅
            sources_to_return = [{"title": s['title'], "url": s['url']} for s in search_sources]
        else:
            # 검색 실패 시 오류 메시지를 출처로 반환
            sources_to_return = [{"title": f"검색 실패: {search_error or '키/CX ID 미설정'}", "url": "#"}]
    else:
        # 검색을 건너뛰거나 메시지 길이가 너무 짧은 경우, 출처를 비워둡니다.
        print(f"✅ Google 검색 건너뜀 (이미지 첨부 또는 메시지 길이가 3자 미만)")
        sources_to_return = []
    
    # -----------------------------
    # 2. 시스템 메시지 생성 (위치 정보 포함)
    # -----------------------------
    system_content = "당신은 분리수거 전문가 챗봇입니다. 한국의 최신 분리수거 기준을 고려하여 답변해 주세요. "
    
    # 위치 정보 추가 (텍스트/이미지 분석 모두에 적용)
    if user_location and user_location != "알수없음":
         system_content += f"사용자의 현재 위치는 '{user_location}'입니다. 가능한 경우 이 지역의 규정을 참고하여 답변하세요. "
    
    # RAG 컨텍스트 추가 (텍스트 대화 시)
    system_content += context
        
    # -----------------------------
    # 3. OpenAI API 호출 (이미지 유무에 따라 분기)
    # -----------------------------
    try:
        messages = [{"role": "system", "content": system_content}]
        user_content = []

        if image_data_url:
            print("✅ Vision API 호출 (이미지 분석 포함)")
            # 이미지 분석 시스템 프롬프트 추가
            image_system_prompt = "이미지 속 물품을 분석하고, 해당 물품의 정확한 분리수거 방법(씻기/분리/배출)을 한국어로 상세하게 안내해 주세요. 물품 인식이 어렵거나 분리수거 대상이 아닌 경우에도 간결하게 답변해 주세요."
            messages[0]["content"] += image_system_prompt
            
            # 사용자 메시지에 이미지 URL과 텍스트 모두 추가
            user_content.append({"type": "text", "text": user_message or "이 물건을 어떻게 분리수거해야 하나요?"})
            user_content.append({"type": "image_url", "image_url": {"url": image_data_url}})
        else:
            print("✅ Standard Chat API 호출 (텍스트 기반)")
            user_content.append({"type": "text", "text": user_message})

        messages.append({"role": "user", "content": user_content})

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            max_tokens=1000,
        )

        chatbot_response = response.choices[0].message.content
        
        # 이미지 분석 시에는 출처가 없으므로 빈 배열을 반환
        if image_data_url:
            sources_to_return = []

        return jsonify({
            "response": chatbot_response,
            "sources": sources_to_return,
            "status": "success"
        })

    except Exception as e:
        print("❌ 챗봇 API 호출 중 오류:", e)
        # 이미지 분석 시 발생한 오류라면 출처를 제공하지 않음
        sources_to_return = [] if image_data_url else sources_to_return
        return jsonify({
            "error": f"챗봇 API 호출 중 오류가 발생했습니다: {str(e)}",
            "sources": sources_to_return # 텍스트 모드였으면 검색 실패 정보를 반환
        }), 500

if __name__ == "__main__":
    # DB 초기화 및 데이터 삽입을 위해 db_init.py 호출
    from static.data.db_init import init_db_with_data 
    with app.app_context():
        # 서버 시작 시 테이블 생성 및 데이터 삽입 (개발 환경용)
        init_db_with_data() 
    app.run(debug=True)