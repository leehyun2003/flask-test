console.log("JS 파일 로드됨 (기능 1, 2, 3 통합)");

// --------------------
// 기능 1: 위치 기반 정보 (Reverse Geocoding)
// --------------------

// 1️⃣ 브라우저 위치 가져오기
navigator.geolocation.getCurrentPosition(success, error);

function success(position) {
  console.log("위치 가져오기 성공");
  const lat = position.coords.latitude;
  const lon = position.coords.longitude;
  console.log(`위도: ${lat}, 경도: ${lon}`);
  getAddress(lat, lon);
}

function error(err) {
  console.error("위치 정보를 가져오는 중 오류:", err);
  document.getElementById("location-info-display").innerHTML = `<p class="text-center">📍 위치 정보를 가져올 수 없습니다.</p>`;
}

// 2️⃣ Flask 서버를 통해 Reverse Geocoding 실행
// main.js 파일의 getAddress 함수 전체
// main.js 파일의 getAddress 함수 전체
// main.js 파일의 getAddress 함수 전체
// main.js 파일의 getAddress 함수 전체
// main.js 파일의 getAddress 함수 전체
async function getAddress(lat, lon) {
  console.log("서버로 Reverse Geocoding 요청 시작");
  try {
    const response = await fetch("/reverse-geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude: lat, longitude: lon })
    });

    const data = await response.json();
    console.log("서버 응답 (Nominatim):", data);

    if (data.error) throw new Error(data.error);

    const address = data.address;
    
    // 1. city (DB 조회용)를 '시' 단위에서 가져옵니다. (예: 성남시)
    const city = address.county || address.city || address.town || "알수없음"; 
    
    // 2. districtKey (DB 조회용)를 '구' 단위에서 가져옵니다. (예: 분당구)
    // Nominatim 응답에 '분당구'가 포함된 경우를 찾습니다.
    let districtGu = address.city_district || address.suburb || ""; 

    // 💡 최종 로직 추가: address 객체에서 '분당구'를 명시적으로 찾습니다.
    // display_name 전체 문자열을 사용하여 "분당구"가 포함되었는지 확인하고, 
    // 만약 `districtGu`가 비어있다면 `display_name`에서 '분당구'를 찾습니다.
    if (!districtGu && data.display_name && data.display_name.includes("분당구")) {
        districtGu = "분당구";
    }

    // DB 조회에 사용할 최종 지역명 (예: 분당구)
    // 만약 '구' 정보를 찾지 못했다면 '시' 정보를 대체 키로 사용합니다.
    let districtName = districtGu || city; 

    // 최종 DB 조회 키 (공백 제거): '분당구'
    const districtKey = districtName.replace(/\s/g, "");
    
    // 화면 표시용 이름 (예: 성남시 분당구)
    const districtOriginal = `${city} ${districtName}`.trim().replace(/\s+/g, ' '); 

    console.log(`매핑된 city (DB): ${city}, 매핑된 districtKey (DB): ${districtKey}, 화면 표시: ${districtOriginal}`);

    // DB 조회: city = '성남시', districtKey = '분당구'를 기대
    loadRecycleInfo(city, districtKey, districtOriginal);

  } catch (err) {
    console.error("Reverse Geocoding 중 오류:", err);
    document.getElementById("location-info-display").innerHTML = `<p class="text-center">📍 위치 API 호출 중 오류가 발생했습니다.</p>`;
  }
}
    

// --------------------
// ✅ 기능 1 & 2 통합: DB에서 위치 및 가이드 정보 조회
// --------------------
let guideData = null; // 가이드 데이터 캐싱

/**
 * Flask 서버의 /get-recycle-info 엔드포인트를 호출하여
 * 지역별 정보와 전체 가이드 정보를 DB에서 조회합니다.
 */
async function loadRecycleInfo(city, districtKey, districtOriginal) {
  console.log("DB 데이터 로드 시작: /get-recycle-info 호출");
  const container = document.getElementById("location-info-display");
  const categoryGrid = document.getElementById("category-grid");

  try {
    const res = await fetch("/get-recycle-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city: city, districtKey: districtKey })
    });
    
    const data = await res.json();
    console.log("DB 서버 응답 수신:", data);

    // 1. 위치별 분리수거 정보 처리
    const info = data.location_info; 
    
    if (!info) {
      container.innerHTML = `<p class="text-center">📍 ${districtOriginal} 지역의 데이터가 없습니다.</p>`;
    } else {
      // 위치 정보를 헤더에 렌더링
      container.innerHTML = `
        <h3 class="font-semibold text-base mb-1">📍 ${districtOriginal}</h3>
        <p class="text-xs"><strong>배출시간:</strong> ${info["배출시간"]}</p>
        
        <details class="mt-2 text-xs cursor-pointer">
          <summary class="font-semibold">상세 정보 보기 (재활용품, 봉투)</summary>
          
          <div class="mt-1 p-2 bg-emerald-800/50 rounded">
            <p class="font-semibold">재활용품:</p>
            <ul class="mt-1 list-disc list-inside pl-2">
              ${Object.entries(info["재활용품"]).map(([k, v]) => `<li>${k}: ${v}</li>`).join("")}
            </ul>
          </div>
          
          <div class="mt-1 p-2 bg-emerald-800/50 rounded">
            <p class="font-semibold">봉투 색상:</p>
            <ul class="mt-1 list-disc list-inside pl-2">
              ${Object.entries(info["봉투색상"]).map(([k, v]) => `<li>${k}: ${v}</li>`).join("")}
            </ul>
          </div>
        </details>
      `;
    }

    // 2. 가이드 정보 처리
    guideData = data.guide_data; // DB에서 조회된 가이드 정보 저장
    
    if (guideData && guideData.categories) {
        renderCategories(); // 가이드 정보 렌더링
    } else {
        categoryGrid.innerHTML = `<p class="text-red-500 col-span-3">가이드 정보를 불러오는데 실패했습니다.</p>`;
    }

  } catch (err) {
    console.error("DB API 로드 중 오류:", err);
    container.innerHTML = `<p class="text-center">📍 분리수거 정보 로드 중 오류 발생.</p>`;
    categoryGrid.innerHTML = `<p class="text-red-500 col-span-3">가이드 정보를 불러오는데 실패했습니다.</p>`;
  }
}


// --------------------
// 기능 2: 카테고리별 분리수거 가이드 (렌더링 로직은 유지)
// --------------------

/**
 * 메인 카테고리를 렌더링
 */
function renderCategories() {
  const grid = document.getElementById("category-grid");
  if (!guideData || !guideData.categories) {
    grid.innerHTML = `<p class="text-red-500 col-span-3">잘못된 가이드 데이터입니다.</p>`;
    return;
  }

  grid.innerHTML = guideData.categories.map(category => `
    <button class="category-btn p-3 bg-gray-100 rounded-lg shadow-sm text-center hover:bg-emerald-100 transition" data-category="${category.name}">
      <span class="text-2xl">${category.icon}</span>
      <span class="block text-xs font-medium text-gray-700 mt-1">${category.name}</span>
    </button>
  `).join("");

  // 각 버튼에 이벤트 리스너 추가
  grid.querySelectorAll('.category-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      showCategoryItems(btn.dataset.category);
    });
  });
}

/**
 * 특정 카테고리의 하위 항목들을 표시
 */
function showCategoryItems(categoryName) {
  const category = guideData.categories.find(c => c.name === categoryName);
  if (!category) return;

  const itemListContainer = document.getElementById("item-list-container");
  const categoryGrid = document.getElementById("category-grid");

  // 카테고리 아이템 HTML 생성
  itemListContainer.innerHTML = `
    <button id="back-to-categories" class="text-sm font-semibold text-emerald-600 hover:text-emerald-800 mb-2">
      &larr; 뒤로가기
    </button>
    <h3 class="text-lg font-semibold text-gray-800 mb-2">${category.icon} ${category.name}</h3>
    <div class="flex flex-col space-y-2">
      ${category.items.map(item => `
        <button class="item-btn p-3 bg-white rounded-lg shadow text-left text-gray-700 hover:bg-gray-50 transition" data-category="${categoryName}" data-item="${item.name}">
          ${item.name}
        </button>
      `).join("")}
    </div>
  `;

  // '뒤로가기' 버튼에 이벤트 리스너 추가
  document.getElementById("back-to-categories").addEventListener('click', () => {
    itemListContainer.classList.add('hidden');
    categoryGrid.classList.remove('hidden');
    itemListContainer.innerHTML = "";
  });

  // 각 아이템 버튼에 이벤트 리스너 추가
  itemListContainer.querySelectorAll('.item-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      showItemDescription(btn.dataset.category, btn.dataset.item);
    });
  });

  // 화면 전환
  categoryGrid.classList.add('hidden');
  itemListContainer.classList.remove('hidden');
}

/**
 * 모달에 아이템 상세 설명 표시
 */
function showItemDescription(categoryName, itemName) {
  const category = guideData.categories.find(c => c.name === categoryName);
  const item = category?.items.find(i => i.name === itemName);
  if (!item) return;

  const modal = document.getElementById("item-modal");
  document.getElementById("modal-title").innerText = item.name;
  document.getElementById("modal-description").innerText = item.description;
  
  modal.showModal(); // 모달 열기
}

/**
 * 모달 닫기
 */
function closeModal() {
  const modal = document.getElementById("item-modal");
  modal.close(); 
}

// --------------------
// 기능 3: 카메라 연동 및 챗봇 (기존 코드 유지)
// --------------------

const cameraInput = document.getElementById("camera-input");
const openCameraBtn = document.getElementById("open-camera-btn");
const imagePreviewContainer = document.getElementById("image-preview-container");
const imagePreview = document.getElementById("image-preview");
const analyzeBtn = document.getElementById("analyze-btn");
const chatbotResponseContainer = document.getElementById("chatbot-response-container");

let uploadedImageBase64 = null; // 업로드된 이미지의 Base64 데이터 URL을 저장할 변수

/**
 * 사용자에게 이미지 파일을 선택하게 하거나 카메라를 엽니다.
 */
openCameraBtn.addEventListener('click', () => {
    cameraInput.click(); 
});

/**
 * 파일이 선택되면 미리보기를 표시하고 분석 버튼을 활성화합니다.
 */
cameraInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        // 1. 파일 리더를 사용하여 이미지를 Base64로 변환 (서버 전송용)
        const reader = new FileReader();
        reader.onload = function(e) {
            uploadedImageBase64 = e.target.result; // Base64 데이터 URL 저장 (data:image/...)
            
            // 2. 미리보기 업데이트
            imagePreview.src = uploadedImageBase64;
            imagePreviewContainer.classList.remove('hidden');
            
            // 3. 분석 버튼 활성화 및 UI 업데이트
            analyzeBtn.classList.remove('hidden');
            analyzeBtn.disabled = false;
            analyzeBtn.innerText = "✨ 분리수거 방법 분석하기";
            chatbotResponseContainer.innerHTML = `<p class="text-gray-500 text-sm">이미지 준비 완료. 분석 버튼을 눌러주세요.</p>`;
        };
        reader.readAsDataURL(file); // 파일을 Base64 데이터 URL로 읽기
    }
});

/**
 * 분석 버튼 클릭 이벤트: Flask 서버에 Base64 이미지를 전송합니다.
 */
analyzeBtn.addEventListener('click', async () => {
    if (!uploadedImageBase64) {
        alert("먼저 이미지를 선택해 주세요.");
        return;
    }

    // UI 상태: 로딩 시작
    analyzeBtn.disabled = true;
    analyzeBtn.innerText = "🔄 분석 중...";
    chatbotResponseContainer.innerHTML = `<p class="text-blue-500 font-medium">🤖 AI 챗봇이 분리수거 방법을 분석하고 있습니다. 잠시만 기다려주세요...</p>`;
    
    console.log("기능 3: 챗봇 이미지 분석 요청 시작");

    try {
        const response = await fetch("/chatbot-analyze-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                image_data_url: uploadedImageBase64 
            })
        });

        const data = await response.json();
        console.log("챗봇 서버 응답:", data);

        // UI 상태: 응답 처리
        analyzeBtn.disabled = false;
        analyzeBtn.innerText = "✨ 다시 분석하기";
        
        if (data.error) {
            chatbotResponseContainer.innerHTML = `
                <h4 class="font-bold text-red-600 mb-1">❌ 오류 발생</h4>
                <p class="text-sm text-red-500 whitespace-pre-wrap">${data.error}</p>
            `;
            console.error("챗봇 오류:", data.error);
        } else {
            chatbotResponseContainer.innerHTML = `
                <h4 class="font-bold text-emerald-700 mb-2">✅ 분리수거 방법 (AI 챗봇)</h4>
                <p class="text-sm text-gray-700 text-left whitespace-pre-wrap">${data.response}</p>
            `;
        }

    } catch (err) {
        console.error("챗봇 API 호출 중 네트워크 오류:", err);
        analyzeBtn.disabled = false;
        analyzeBtn.innerText = "✨ 분리수거 방법 분석하기";
        chatbotResponseContainer.innerHTML = `
            <h4 class="font-bold text-red-600 mb-1">❌ 네트워크 오류</h4>
            <p class="text-sm text-red-500">서버와 통신 중 문제가 발생했습니다. (Console 확인)</p>
        `;
    }
});


// --------------------
// 초기화
// --------------------
document.addEventListener('DOMContentLoaded', () => {
  // 모달 닫기 버튼 이벤트
  const modalCloseBtn = document.getElementById("modal-close-btn");
  if(modalCloseBtn) {
    modalCloseBtn.addEventListener('click', closeModal);
  }
  
  // 💡 기존 loadDisposalGuide 호출은 제거되었음.
  // 가이드 로드는 이제 위치 정보 로드(loadRecycleInfo)에 의해 자동으로 처리됩니다.
});
