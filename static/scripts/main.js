console.log("JS 파일 로드됨 (기능 1: 위치기반 정보)");

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
  // HTML 구조에 맞게 location-info-display를 찾습니다.
  document.getElementById("location-info-display").innerHTML = `<p class="text-center">📍 위치 정보를 가져올 수 없습니다.</p>`;
}

// 2️⃣ Flask 서버를 통해 Reverse Geocoding 실행
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
      district = address.county + address.city_district; // "성남시분당구"
    } else if (address.county) {
      district = address.county;
    } else if (address.city_district) {
      district = address.city_district;
    } else {
      district = "알수없음";
    }

    const districtKey = district.replace(/\s/g, "");
    console.log(`매칭 city: ${city}, district: ${district}, districtKey: ${districtKey}`);

    // loadRecycleInfo 호출 시 districtKey와 원본 district 이름 전달
    loadRecycleInfo(city, districtKey, district);

  } catch (err)
 {
    console.error("Reverse Geocoding 중 오류:", err);
    document.getElementById("location-info-display").innerHTML = `<p class="text-center">📍 위치 API 호출 중 오류가 발생했습니다.</p>`;
  }
}

// 3️⃣ JSON 파일에서 분리수거 정보 가져오기
async function loadRecycleInfo(city, districtKey, districtOriginal) {
  console.log("JSON 데이터 로드 시작");
  // HTML 구조에 맞게 location-info-display를 찾습니다.
  const container = document.getElementById("location-info-display");

  try {
    const res = await fetch("/static/data/recycle_info.json");
    const data = await res.json();
    console.log("JSON 데이터 불러옴:", data);

    const info = data[city]?.[districtKey];

    if (!info) {
      container.innerHTML = `<p class="text-center">📍 ${city} ${districtOriginal} 지역의 데이터가 없습니다.</p>`;
      return;
    }

    // 위치 정보를 헤더에 예쁘게 표시 (Tailwind CSS 활용)
    container.innerHTML = `
      <h3 class="font-semibold text-base mb-1">📍 ${city} ${districtOriginal}</h3>
      <p class="text-xs"><strong>배출시간:</strong> ${info["배출시간"]}</p>
      
      <!-- 상세 정보는 <details> 태그로 숨겼다가 펼칠 수 있게 합니다 -->
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
  } catch (err) {
    console.error("JSON 로드 중 오류:", err);
    container.innerHTML = `<p class="text-center">📍 분리수거 정보 로드 중 오류 발생.</p>`;
  }
}


// --- 기능 2: 카테고리별 분리수거 가이드 ---

let guideData = null; // 가이드 데이터 캐싱

/**
 * 가이드 데이터 (JSON) 로드 및 초기화
 */
async function loadDisposalGuide() {
  console.log("기능 2: 가이드 데이터 로드 시작");
  try {
    const res = await fetch("/static/data/disposal_guide.json");
    // .json()은 Promise를 반환하므로 await를 사용해야 합니다.
    const data = await res.json(); 
    guideData = data; // 데이터 캐싱
    console.log("가이드 데이터 로드 완료:", guideData);
    renderCategories(); // 카테고리 렌더링
  } catch (err) {
    console.error("가이드 JSON 로드 중 오류:", err);
    document.getElementById("category-grid").innerHTML = `<p class="text-red-500 col-span-3">가이드 정보를 불러오는데 실패했습니다.</p>`;
  }
}

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
 * @param {string} categoryName - 표시할 카테고리 이름
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
    itemListContainer.innerHTML = ""; // 컨테이너 비우기
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
 * @param {string} categoryName - 찾을 카테고리 이름
 * @param {string} itemName - 찾을 아이템 이름
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
  modal.close(); // 모달 닫기
}

// DOM이 로드된 후, 또는 파일 끝에서 기능 2 관련 함수들을 초기화합니다.
document.addEventListener('DOMContentLoaded', () => {
  // 모달 닫기 버튼 이벤트
  const modalCloseBtn = document.getElementById("modal-close-btn");
  if(modalCloseBtn) {
    modalCloseBtn.addEventListener('click', closeModal);
  } else {
    console.error("모달 닫기 버튼을 찾을 수 없습니다.");
  }
  
  // 기능 2(가이드) 데이터 로드 시작
  loadDisposalGuide();
});