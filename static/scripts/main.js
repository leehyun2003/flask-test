console.log("JS 파일 로드됨 (기능 1, 2, 3 통합 - DB 연동 버전)");

// --------------------
// 기능 1: 위치 기반 정보 (Reverse Geocoding)
// --------------------

// 1️⃣ 브라우저 위치 가져오기 (유지)
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

// 2️⃣ Flask 서버를 통해 Reverse Geocoding 실행 (유지)
async function getAddress(lat, lon) {
  console.log("서버로 Reverse Geocoding 요청 시작");
  try {
    const response = await fetch("/reverse-geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude: lat, longitude: lon })
    });

    const data = await response.json();
    console.log("서버 응답:", data);

    if (data.error) throw new Error(data.error);

    const address = data.address;
    console.log("Nominatim address:", address);

    const city = address.state || "알수없음";
    let district = "";
    if (address.county && address.city_district) {
      district = address.county + address.city_district;
    } else if (address.county) {
      district = address.county;
    } else if (address.city_district) {
      district = address.city_district;
    } else {
      district = "알수없음";
    }

    const districtKey = district.replace(/\s/g, "");
    console.log(`매칭 city: ${city}, district: ${district}, districtKey: ${districtKey}`);

    // ✅ DB에서 위치 정보 및 가이드 정보를 모두 가져오는 함수 호출로 변경
    loadRecycleInfoFromDB(city, districtKey, district);

  } catch (err) {
    console.error("Reverse Geocoding 중 오류:", err);
    document.getElementById("location-info-display").innerHTML = `<p class="text-center">📍 위치 API 호출 중 오류가 발생했습니다.</p>`;
  }
}

// 3️⃣ DB에서 분리수거 정보와 가이드 가져오기 (새로운 함수)
let guideData = null; // 가이드 데이터 캐싱

async function loadRecycleInfoFromDB(city, districtKey, districtOriginal) {
  console.log("DB 데이터 로드 시작: /get-recycle-info 호출");
  const container = document.getElementById("location-info-display");
  const categoryGrid = document.getElementById("category-grid");

  try {
    // 서버의 새로운 엔드포인트 호출 (위치 정보 + 가이드 정보 통합)
    const res = await fetch("/get-recycle-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city: city, districtKey: districtKey })
    });
    
    const data = await res.json();
    console.log("DB 서버 응답 수신:", data);

    const info = data.location_info; 
    guideData = data.guide_data;     // DB에서 조회된 가이드 정보 저장

    // A. 위치 정보 (location_info) 업데이트
    if (!info) {
      container.innerHTML = `<p class="text-center">📍 ${city} ${districtOriginal} 지역의 데이터가 없습니다.</p>`;
    } else {
      // 위치 정보를 헤더에 렌더링
      container.innerHTML = `
        <h3 class="font-semibold text-base mb-1">📍 ${city} ${districtOriginal}</h3>
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

    // B. 가이드 정보 (guide_data) 업데이트
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
// 기능 2: 카테고리별 분리수거 가이드 (렌더링 함수 유지)
// --------------------

// ⚠️ 기존 loadDisposalGuide 함수는 loadRecycleInfoFromDB에 통합되었으므로 제거합니다.

/**
 * 메인 카테고리를 렌더링 (유지)
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
 * 특정 카테고리의 하위 항목들을 표시 (유지)
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
 * 모달에 아이템 상세 설명 표시 (유지)
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
 * 모달 닫기 (유지)
 */
function closeModal() {
  const modal = document.getElementById("item-modal");
  modal.close(); 
}

// --------------------
// 기능 3: 카메라 연동 및 챗봇 (유지)
// --------------------
// ... (기존 기능 3 코드 유지: cameraInput, openCameraBtn, analyzeBtn 관련 로직) ...

const cameraInput = document.getElementById("camera-input");
const openCameraBtn = document.getElementById("open-camera-btn");
const imagePreviewContainer = document.getElementById("image-preview-container");
const imagePreview = document.getElementById("image-preview");
const analyzeBtn = document.getElementById("analyze-btn");
const chatbotResponseContainer = document.getElementById("chatbot-response-container");

let uploadedImageBase64 = null;

openCameraBtn.addEventListener('click', () => {
    cameraInput.click(); 
});

cameraInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            uploadedImageBase64 = e.target.result;
            imagePreview.src = uploadedImageBase64;
            imagePreviewContainer.classList.remove('hidden');
            analyzeBtn.classList.remove('hidden');
            analyzeBtn.disabled = false;
            analyzeBtn.innerText = "✨ 분리수거 방법 분석하기";
            chatbotResponseContainer.innerHTML = `<p class="text-gray-500 text-sm">이미지 준비 완료. 분석 버튼을 눌러주세요.</p>`;
        };
        reader.readAsDataURL(file);
    }
});

analyzeBtn.addEventListener('click', async () => {
    if (!uploadedImageBase64) {
        alert("먼저 이미지를 선택해 주세요.");
        return;
    }

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

        analyzeBtn.disabled = false;
        analyzeBtn.innerText = "✨ 다시 분석하기";
        
        if (data.error) {
            chatbotResponseContainer.innerHTML = `
                <h4 class="font-bold text-red-600 mb-1">❌ 오류 발생</h4>
                <p class="text-sm text-red-500 whitespace-pre-wrap">${data.error}</p>
            `;
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
// 초기화 (유지)
// --------------------
document.addEventListener('DOMContentLoaded', () => {
  const modalCloseBtn = document.getElementById("modal-close-btn");
  if(modalCloseBtn) {
    modalCloseBtn.addEventListener('click', closeModal);
  }
  
  // loadDisposalGuide()는 loadRecycleInfoFromDB에 통합되었습니다.
});