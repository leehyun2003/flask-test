# db_init.py
import os
import sqlite3

DATABASE = 'smart_recycle.db'

# --------------------
# ⚠️ DATA 정의: 기존 recycle_info.json 및 disposal_guide.json의 전체 내용
# --------------------

# db_init.py (수정할 부분)

RECYCLE_INFO_DATA = {
  "서울특별시": { # 서울특별시 -> 서울시 (혹은 그대로 사용 가능하지만, 통일성을 위해)
    "강남구": {
      "배출시간": "월~금 오후 8시 ~ 오전 5시",
      "재활용품": { "페트병": "목요일", "비닐": "목요일", "기타": "월~금, 일 녹색 그물망" },
      "봉투색상": { "소각용": "원색", "음식물용": "하늘색", "재사용": "연보라색" }
    },
    "서초구": {
      "배출시간": "월~금 오후 9시 ~ 오전 6시",
      "재활용품": { "페트병": "수요일", "비닐": "수요일", "기타": "월~금, 일 녹색 그물망" },
      "봉투색상": { "소각용": "주황색", "음식물용": "파란색", "재사용": "연두색" }
    }
  },
  # 💡 경기도를 '성남시', '수원시'로 분리
  "성남시": { 
    "분당구": { # 키를 '분당구'로 단순화
      "배출시간": "월~금 일몰 후 ~ 오전 5시 (토요일 부분 수거)",
      "재활용품": { "일반": "수거 전날 일몰 후 배출" },
      "봉투색상": { "소각용": "녹색", "음식물용": "노란색", "재사용": "옅은 회색" }
    }
  },
  "수원시": {
    "영통구": { # 키를 '영통구'로 단순화
      "배출시간": "월~금 오후 7시 ~ 오전 5시",
      "재활용품": { "페트병": "화요일", "비닐": "화요일", "기타": "월~금, 일 녹색 그물망" },
      "봉투색상": { "소각용": "빨강", "음식물용": "파랑", "재사용": "보라" }
    }
  },
  "부산광역시": {
    "해운대구": {
      "배출시간": "월~금 오후 8시 ~ 오전 6시",
      "재활용품": { "페트병": "금요일", "비닐": "금요일", "기타": "월~금, 일 녹색 그물망" },
      "봉투색상": { "소각용": "검정", "음식물용": "파랑", "재사용": "노랑" }
    }
  }
}

DISPOSAL_GUIDE_DATA = {
  "categories": [
    {
      "name": "가구/인테리어",
      "icon": "🛋️",
      "items": [
        { 
          "name": "전구 (형광등/LED)", 
          "image_path": "/static/images/LED.jpeg",
          "description": "형광등과 LED 전구는 깨지지 않게 주의하여 아파트 단지 내 전용 수거함이나 주민센터 수거함에 배출해야 합니다.\n\n깨졌을 경우: 신문지 등으로 잘 감싸서 불연성 쓰레기 봉투(특수 규격 마대)에 넣어 배출하세요." 
        },
        { 
          "name": "전구 (백열전구)", 
          "image_path":"/static/images/whitelight.jpg",
          "description": "백열전구는 재활용이 불가능합니다. 신문지 등으로 감싸 깨지지 않게 하여 불연성 쓰레기 봉투(특수 규격 마대)에 버려야 합니다." 
        },
        { 
          "name": "거울", 
          "image_path":"/static/images/mirror.jpeg",
          "description": "거울은 유리가 아닙니다. 재활용이 불가능합니다.\n\n작은 거울: 불연성 쓰레기 봉투(특수 규격 마대)에 넣어 배출하세요.\n큰 거울 (전신 거울 등): 대형 폐기물로 신고 후 스티커를 부착하여 배출해야 합니다." 
        },
        { 
          "name": "목재 가구 (의자, 책상 등)", 
          "image_path":"/static/images/목재가구.jpeg",
          "description": "대형 폐기물로 신고 후 스티커를 부착하여 배출해야 합니다. 주민센터, 구청 홈페이지 또는 관련 앱을 통해 '대형폐기물 배출'을 검색하여 신고하세요." 
        }
      ]
    },
    {
      "name": "가전제품",
      "icon": "🔌",
      "items": [
        { 
          "name": "소형 가전 (1m 미만)", 
          "image_path":"/static/images/소형가전.jpg",
          "description": "드라이기, 믹서기, 선풍기, 다리미 등 1m 미만의 소형 가전은 아파트 단지 내 전용 수거함이나 주민센터 수거함에 배출하세요.\n\n5개 이상 모았을 경우: '폐가전 무상방문수거' (1599-0903 또는 www.15990903.or.kr) 서비스를 신청할 수 있습니다." 
        },
        { 
          "name": "대형 가전 (1m 이상)", 
          "image_path":"/static/images/대형가전.jpeg",
          "description": "냉장고, 세탁기, TV, 에어컨 등 대형 가전은 '폐가전 무상방문수거' (1599-0903 또는 www.15990903.or.kr) 서비스를 예약하여 배출하세요. 스티커가 필요 없으며 무료로 수거해 갑니다." 
        },
        {
          "name": "휴대폰 배터리/보조배터리",
          "image_path":"/static/images/보조배터리.webp",
          "description": "폭발 위험이 있으므로 절대 일반쓰레기나 재활용에 버리면 안 됩니다. 주민센터나 아파트 단지 내 폐건전지 수거함에 반드시 분리 배출하세요."
        }
      ]
    },
    {
      "name": "주방용품",
      "icon": "🍳",
      "items": [
        { 
          "name": "유리 그릇/접시/컵", 
          "image_path":"/static/images/유리.jpeg",
          "description": "재활용되는 유리병이 아닙니다. (소주병, 맥주병 등과 다름)\n깨지지 않은 경우: 불연성 쓰레기 봉투(특수 규격 마대)에 넣어 배출하세요.\n깨진 경우: 신문지 등으로 잘 감싸서 불연성 쓰레기 봉투에 넣어 배출하세요." 
        },
        { 
          "name": "도자기 그릇/접시", 
          "image_path":"/static/images/도자기.jpeg",
          "description": "재활용이 불가능합니다. 깨지지 않게 신문지 등으로 감싸서 불연성 쓰레기 봉투(특수 규격 마대)에 버려야 합니다." 
        },
        { 
          "name": "후라이팬 / 냄비", 
          "image_path":"/static/images/조리.jpeg",
          "description": "손잡이가 플라스틱이나 나무 재질이면 분리 후, 본체는 캔류(고철)로 분리 배출하세요.\n분리가 어려울 경우: 그대로 캔류로 배출합니다 (지역에 따라 다를 수 있으나 고철로 분류하는 것이 일반적입니다)." 
        }
      ]
    },
    {
      "name": "용기/포장재",
      "icon": "♻️",
      "items": [
        { 
          "name": "페트병 (PET)", 
          "image_path":"/static/images/페트병.jpeg",
          "description": "1. 내용물을 깨끗이 비우고 헹굽니다.\n2. 겉의 비닐 라벨을 깨끗이 제거합니다.\n3. 찌그러트려 부피를 줄이고 뚜껑을 닫아 배출합니다.\n(뚜껑과 링도 재활용 공정에서 분리 가능하니 닫아서 배출하는 것이 좋습니다.)\n\n*반드시 '투명 페트병' 전용 수거함에 배출하세요." 
        },
        { 
          "name": "스티로폼 (EPS)", 
          "image_path":"/static/images/스트리폼.jpeg",
          "description": "1. 테이프와 운송장 스티커를 모두 제거합니다.\n2. 이물질이 묻지 않은 '하얀색' 스티로폼만 재활용 가능합니다.\n\n*주의: 컵라면 용기, 유색 스티로폼, 과일 받침대, 오염이 심한 스티로폼은 재활용이 불가능하므로 일반 쓰레기(종량제 봉투)에 버려야 합니다." 
        },
        {
          "name": "비닐류 (필름류)",
          "image_path":"/static/images/비닐.jpeg",
          "description": "과자 봉지, 라면 봉지, 빵 봉지 등 '비닐류' 마크가 있는 모든 비닐은 내용물을 비우고 깨끗이 헹군 후 '비닐류' 전용 수거함에 모아서 배출합니다.\n\n*주의: 이물질 제거가 어렵거나, '비닐류' 마크가 없는 랩 등은 일반 쓰레기입니다."
        }
      ]
    },
    {
      "name": "패션/잡화",
      "icon": "👕",
      "items": [
        {
          "name": "헌 옷",
          "image_path":"/static/images/헌 옷.jpg",
          "description": "깨끗하고 재사용 가능한 옷은 '의류 수거함'에 배출합니다.\n\n*주의: 솜이불, 베개, 방석, 캐리어, 롤러스케이트, 젖은 의류 등은 의류 수거함에 넣으면 안 됩니다. 이불은 대형 폐기물 또는 일반 쓰레기로, 신발은 상태가 좋으면 신발만 따로 모아 배출합니다."
        },
        {
          "name": "가방 (천/가죽)",
          "image_path":"/static/images/가방.jpeg",
          "description": "재활용이 어렵습니다. 일반 쓰레기(종량제 봉투)로 버려주세요. 크기가 큰 여행용 캐리어 등은 대형 폐기물로 신고 후 배출해야 합니다."
        }
      ]
    },
    {
      "name": "기타",
      "icon": "📦",
      "items": [
        {
          "name": "우산",
          "image_path":"/static/images/우산.jpeg",
          "description": "재질(천, 쇠, 플라스틱)이 복잡하여 분리 배출이 어렵습니다.\n\n- 가능하면 비닐/천 부분과 뼈대를 분리하여, 뼈대는 고철(캔류)로, 비닐/천은 일반 쓰레기로 버립니다.\n- 분리가 어려우면 통째로 일반 쓰레기(종량제 봉투)에 버리거나, 종량제 봉투에 들어가지 않는 큰 우산은 대형 폐기물로 신고합니다."
        },
        {
          "name": "폐식용유",
          "image_path":"/static/images/식용유.jpeg",
          "description": "절대 하수구에 버리면 안 됩니다. 신문지나 키친타월에 흡수시켜 일반 쓰레기(종량제 봉투)로 버리거나, 양이 많을 경우 주민센터나 아파트 단지 내 폐유 전용 수거함에 배출하세요."
        }
      ]
    }
  ]
}


def create_tables(conn):
    """DB 테이블 생성 (DDL)"""
    cursor = conn.cursor()
    
    # 1. CITY_DISTRICT 테이블
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS city_district (
            district_id INTEGER PRIMARY KEY AUTOINCREMENT,
            city_name TEXT NOT NULL,         
            district_name TEXT NOT NULL UNIQUE,     
            discharge_time TEXT NOT NULL
        );
    """)

    # 2. RECYCLE_DETAIL 테이블
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS recycle_detail (
            detail_id INTEGER PRIMARY KEY AUTOINCREMENT,
            district_id INTEGER NOT NULL,
            info_type TEXT NOT NULL,         
            item_name TEXT NOT NULL,         
            info_value TEXT NOT NULL,        
            FOREIGN KEY (district_id) REFERENCES city_district(district_id)
        );
    """)

    # 3. GUIDE_CATEGORY 테이블
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS guide_category (
            category_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,       
            icon TEXT                        
        );
    """)

    # 4. GUIDE_ITEM 테이블
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS guide_item (
            item_id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id INTEGER NOT NULL,
            name TEXT NOT NULL,              
            description TEXT NOT NULL, 
            image_path TEXT,     
            FOREIGN KEY (category_id) REFERENCES guide_category(category_id)
        );
    """)
    conn.commit()
    print("✅ DB 테이블 생성 완료.")


def insert_recycle_info(conn, data):
    """CityDistrict와 RecycleDetail 데이터 삽입 (Pure SQL DML)"""
    cursor = conn.cursor()
    print("➡️ 지역별 분리수거 정보 삽입 시작...")
    
    for city, districts in data.items():
        for district_key, info in districts.items():
            # 1. CityDistrict 삽입
            cursor.execute("""
                INSERT INTO city_district (city_name, district_name, discharge_time) 
                VALUES (?, ?, ?)
            """, (city, district_key, info["배출시간"]))
            
            # 삽입된 행의 ID를 가져옵니다.
            district_id = cursor.lastrowid 
            
            # 2. RecycleDetail (재활용품) 삽입
            recycle_details = []
            for item, value in info["재활용품"].items():
                recycle_details.append((district_id, "재활용품", item, value))
                
            # 3. RecycleDetail (봉투색상) 삽입
            for item, value in info["봉투색상"].items():
                recycle_details.append((district_id, "봉투색상", item, value))
            
            cursor.executemany("""
                INSERT INTO recycle_detail (district_id, info_type, item_name, info_value) 
                VALUES (?, ?, ?, ?)
            """, recycle_details)

    conn.commit()
    print("✅ 지역별 분리수거 정보 삽입 완료.")


def insert_disposal_guide(conn, data):
    """GuideCategory와 GuideItem 데이터 삽입 (Pure SQL DML)"""
    cursor = conn.cursor()
    print("➡️ 분리수거 가이드 정보 삽입 시작...")
    
    for category_data in data["categories"]:
        # 1. GuideCategory 삽입
        cursor.execute("""
            INSERT INTO guide_category (name, icon) 
            VALUES (?, ?)
        """, (category_data["name"], category_data["icon"]))
        
        category_id = cursor.lastrowid
        
        # 2. GuideItem 삽입
        item_details = []
        for item_data in category_data["items"]:
            item_details.append((category_id, item_data["name"], item_data["description"],item_data.get("image_path","")))

        cursor.executemany("""
            INSERT INTO guide_item (category_id, name, description,image_path) 
            VALUES (?, ?, ?, ?)
        """, item_details)
            
    conn.commit()
    print("✅ 분리수거 가이드 정보 삽입 완료.")


def init_db_with_data():
    """데이터베이스 초기화 및 데이터 삽입을 수행하는 메인 함수"""
    # 기존 DB 파일이 있으면 삭제하고 새로 만듭니다. (개발 환경용)
    if os.path.exists(DATABASE):
        os.remove(DATABASE)
        print(f"💡 기존 {DATABASE} 파일을 삭제했습니다.")

    # DB 연결
    conn = sqlite3.connect(DATABASE)
    try:
        # 테이블 생성
        create_tables(conn)
        
        # 데이터 삽입
        insert_recycle_info(conn, RECYCLE_INFO_DATA)
        insert_disposal_guide(conn, DISPOSAL_GUIDE_DATA)
        
        print("🎉 데이터베이스 초기화 및 데이터 삽입이 모두 완료되었습니다.")
    except Exception as e:
        print(f"❌ 데이터베이스 초기화 중 오류 발생: {e}")
    finally:
        conn.close()

if __name__ == '__main__':
    # 이 파일 단독 실행 시 DB 초기화
    init_db_with_data()
