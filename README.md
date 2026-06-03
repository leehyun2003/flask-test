# ♻️ 분리수거 도우미

AI와 위치 기반 서비스를 활용하여 사용자가 쉽고 정확하게 분리배출 정보를 확인할 수 있도록 돕는 웹 애플리케이션입니다.

## 프로젝트 소개

많은 사람들이 분리수거를 잘하고 있다고 생각하지만 실제로는 잘못된 방법으로 배출하는 경우가 많습니다.

기존에는 물품별 분리배출 방법이나 지역별 배출 규정을 확인하기 위해 각 지자체 홈페이지를 직접 찾아야 했으며, 이 과정에서 정보 접근성이 떨어지고 사용자 불편이 발생했습니다.

본 프로젝트는 이러한 문제를 해결하기 위해 AI 챗봇, 분리배출 가이드, 위치 기반 지역 규정 조회 기능을 하나의 서비스로 통합하여 제공합니다.

---

## 주요 기능

### 1. AI 챗봇 기반 분리수거 안내

- 사용자가 텍스트 또는 이미지를 입력하면 분리배출 방법을 안내
- GPT-4o와 RAG(Retrieval-Augmented Generation)를 활용하여 답변 생성
- Google CSE 기반 실시간 웹 검색 결과를 활용하여 최신 정보 반영
- 답변과 함께 출처를 제공하여 신뢰성 확보

### 2. 카드뉴스 기반 분리배출 가이드

- 카테고리별 분리배출 정보를 카드 형태로 제공
- SQLite 데이터베이스에 저장된 정보를 조회
- 페이지 이동 없이 동적으로 데이터 로드
- 사용자가 필요한 정보를 빠르게 탐색 가능

### 3. 위치 기반 분리수거 규정 안내

- 사용자의 현재 위치(GPS)를 활용
- 지역별 배출 시간 및 재활용 규정 조회
- 시·구 단위 분리수거 규정 제공
- 세부 규정은 접을 수 있는 UI로 구성하여 가독성 향상

---

## 시스템 아키텍처

### AI 챗봇

User Input → Flask Server → Google CSE → RAG Context 구성 → GPT-4o → Response

### 분리배출 가이드

Flask → SQLite Database → JSON 데이터 구성 → Frontend Rendering

### 위치 기반 조회

GPS → Nominatim OSM API → Flask → SQLite → 지역별 규정 반환

---

## 기술 스택

### Backend
- Python
- Flask

### Database
- SQLite

### AI
- OpenAI GPT-4o
- RAG (Retrieval-Augmented Generation)

### External API
- Google Custom Search Engine (CSE)
- Nominatim OpenStreetMap API

### Frontend
- HTML
- CSS
- JavaScript

---

## 프로젝트 의의

본 프로젝트는 단순히 분리배출 정보를 제공하는 것을 넘어 사용자가 쉽고 빠르게 정확한 정보를 얻을 수 있도록 설계되었습니다.

특히 AI 기반 질의응답과 위치 기반 지역 규정 조회 기능을 결합하여 기존 분리수거 정보 서비스의 접근성 문제를 개선하고자 하였습니다.

---

## 향후 개선 계획

- 읍·면·리 단위까지 세분화된 규정 데이터 구축
- 분리배출 데이터셋 확대
- 사용자 맞춤형 알림 기능 추가
- 모바일 앱 버전 개발
- 이미지 인식 정확도 개선

---

## 개발자

황이현

Big Data Project
