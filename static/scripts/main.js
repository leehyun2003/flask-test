console.log("JS 파일 로드됨 (최종 통합 버전)");

// ----------------------------------------
// ✅ 전역 변수: 위치 정보 및 가이드 데이터 저장
// ----------------------------------------
let userLocation = { city: null, districtKey: null, districtOriginal: null }; 
let guideData = null; // 가이드 데이터 캐싱
let uploadedImageBase64 = null; 

// ----------------------------------------
// UI 요소 정의
// ----------------------------------------
const chatMessagesContainer = document.getElementById("chat-messages-container");
const chatInput = document.getElementById("chat-input");
const sendChatBtn = document.getElementById("send-chat-btn");
const chatbotSourceContainer = document.getElementById("chatbot-source-container");
const sourceList = document.getElementById("source-list");

// 이미지 관련 요소
const cameraInput = document.getElementById("camera-input");
const openCameraBtn = document.getElementById("open-camera-btn");
const imagePreviewContainer = document.getElementById("image-preview-container");
const imagePreview = document.getElementById("image-preview");
const removeImageBtn = document.getElementById("remove-image-btn");

// ----------------------------------------
// 기능 1 & 2: 위치 및 가이드 정보 로드 (변경 없음)
// ----------------------------------------

// 1️⃣ 브라우저 위치 가져오기
navigator.geolocation.getCurrentPosition(success, error);

function success(position) {
  console.log("위치 가져오기 성공");
  const lat = position.coords.latitude;
  const lon = position.coords.longitude;
  getAddress(lat, lon);
}

function error(err) {
  console.error("위치 정보를 가져오는 중 오류:", err);
  document.getElementById("location-info-display").innerHTML = `<p class="text-center">📍 위치 정보를 가져올 수 없습니다.</p>`;
}

// 2️⃣ Reverse Geocoding 및 DB 조회
async function getAddress(lat, lon) {
  console.log("서버로 Reverse Geocoding 요청 시작");
  try {
    const response = await fetch("/reverse-geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude: lat, longitude: lon })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error);

    const address = data.address;
    const city = address.county || address.city || address.town || "알수없음"; 
    let districtGu = address.city_district || address.suburb || ""; 
    
    if (!districtGu && data.display_name && data.display_name.includes("분당구")) {
        districtGu = "분당구";
    }

    let districtName = districtGu || city; 
    const districtKey = districtName.replace(/\s/g, "");
    const districtOriginal = `${city} ${districtName}`.trim().replace(/\s+/g, ' '); 
    
    userLocation = { city, districtKey, districtOriginal }; 

    loadRecycleInfo(city, districtKey, districtOriginal);

  } catch (err) {
    console.error("Reverse Geocoding 중 오류:", err);
    document.getElementById("location-info-display").innerHTML = `<p class="text-center">📍 위치 API 호출 중 오류가 발생했습니다.</p>`;
  }
}
    
async function loadRecycleInfo(city, districtKey, districtOriginal) {
  const container = document.getElementById("location-info-display");
  const categoryGrid = document.getElementById("category-grid");

  try {
    const res = await fetch("/get-recycle-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city: city, districtKey: districtKey })
    });
    
    const data = await res.json();

    // 위치 정보 처리 (생략, 기존 로직 그대로)
    const info = data.location_info; 
    if (!info) {
      container.innerHTML = `<p class="text-center">📍 ${districtOriginal} 지역의 데이터가 없습니다.</p>`;
    } else {
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

    // 가이드 정보 처리
    guideData = data.guide_data; 
    
    if (guideData && guideData.categories) {
        renderCategories(); 
    } else {
        categoryGrid.innerHTML = `<p class="text-red-500 col-span-3">가이드 정보를 불러오는데 실패했습니다.</p>`;
    }

  } catch (err) {
    console.error("DB API 로드 중 오류:", err);
    container.innerHTML = `<p class="text-center">📍 분리수거 정보 로드 중 오류 발생.</p>`;
    categoryGrid.innerHTML = `<p class="text-red-500 col-span-3">가이드 정보를 불러오는데 실패했습니다.</p>`;
  }
}

// ----------------------------------------
// 가이드 카테고리/아이템 렌더링 및 모달 로직
// ----------------------------------------

function renderCategories() {
    const categoryGrid = document.getElementById("category-grid");
    categoryGrid.innerHTML = ''; 
    
    if (!guideData || !guideData.categories) return;

    guideData.categories.forEach(category => {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'p-3 bg-white rounded-lg shadow-sm text-center cursor-pointer hover:bg-emerald-50 transition';
        categoryDiv.innerHTML = `
            <div class="text-3xl">${category.icon}</div>
            <p class="mt-1 text-sm font-medium">${category.name}</p>
        `;
        categoryDiv.addEventListener('click', () => showCategoryItems(category.name));
        categoryGrid.appendChild(categoryDiv);
    });
}

function showCategoryItems(categoryName) {
    const categoryGrid = document.getElementById("category-grid");
    const itemListContainer = document.getElementById("item-list-container");
    const category = guideData.categories.find(c => c.name === categoryName);

    if (!category) return;

    categoryGrid.classList.add('hidden');
    itemListContainer.classList.remove('hidden');

    itemListContainer.innerHTML = `
        <h3 class="text-xl font-semibold text-gray-800 mb-3">${category.icon} ${category.name} <span class="text-sm text-gray-500 float-right cursor-pointer" onclick="goBackToCategories()">← 뒤로</span></h3>
        <div class="space-y-2">
            ${category.items.map(item => `
                <div class="p-3 bg-gray-50 rounded-lg shadow-sm flex justify-between items-center cursor-pointer hover:bg-gray-100 transition" 
                     onclick="showItemDescription('${categoryName}', '${item.name}')">
                    
                    <div class="flex items-center space-x-3">
                        ${item.image_path ?
                            `<img src="${item.image_path}" alt="${item.name}" class="w-8 h-8 object-contain rounded"/>`
                            : `<span class="w-8 h-8 text-xl flex items-center justify-center">📦</span>`}
                        <span class="font-medium">${item.name}</span>
                    </div>

                    <span class="text-emerald-500">자세히 보기 →</span>
                </div>
            `).join('')}
        </div>
    `;
}

function goBackToCategories() {
    document.getElementById("category-grid").classList.remove('hidden');
    document.getElementById("item-list-container").classList.add('hidden');
}

function showItemDescription(categoryName, itemName) {
    const category = guideData.categories.find(c => c.name === categoryName);
    if (!category) return;
    const item = category.items.find(i => i.name === itemName);

    if (item) {
        // ✅ 이미지 경로가 있으면 <img> 태그 사용, 없으면 카테고리 아이콘(이모지) 사용
        const imageHtml = item.image_path 
            ? `<img src="${item.image_path}" alt="${item.name}" class="inline-block w-6 h-6 mr-2 object-contain align-middle"/>` 
            : `${category.icon} `; // 이미지 없으면 기존 카테고리 이모지 사용
            
        document.getElementById('modal-title').innerHTML = `${imageHtml} ${item.name}`;
        document.getElementById('modal-description').innerText = item.description;
        document.getElementById("item-modal").showModal();
    }
}

function closeModal() { 
    document.getElementById("item-modal").close();
}


// ----------------------------------------
// ✅ 기능 3: 통합 챗봇 로직 (메신저 스타일)
// ----------------------------------------

// 챗봇 이벤트 리스너 등록
sendChatBtn.addEventListener('click', handleUnifiedChat);
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        handleUnifiedChat();
    }
});
openCameraBtn.addEventListener('click', () => {
    cameraInput.click(); 
});
removeImageBtn.addEventListener('click', removeImagePreview);


async function handleUnifiedChat() {
    const userMessage = chatInput.value.trim();
    
    // 이미지도 없고 메시지도 없으면 전송 방지
    if (!userMessage && !uploadedImageBase64) return;
    
    // 1. 사용자 메시지 렌더링
    const displayMessage = uploadedImageBase64 ? 
                           (userMessage || "이미지 분석 요청") : 
                           userMessage;
                           
    appendMessage(displayMessage, 'user', false, uploadedImageBase64);
    chatInput.value = '';
    
    // 2. 로딩 메시지 렌더링
    const loadingElement = appendMessage('...', 'chatbot', true);
    sendChatBtn.disabled = true;
    removeImageBtn.disabled = true;

    const currentImageBase64 = uploadedImageBase64; 
    
    // 3. 서버 호출 (통합 엔드포인트 사용)
    try {
        const response = await fetch("/chatbot-unified-chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                message: userMessage, 
                image_data_url: currentImageBase64, 
                location: userLocation.districtOriginal 
            })
        });

        const data = await response.json();

        // 4. 응답 렌더링
        if (data.error) {
            loadingElement.innerHTML = `<span class="text-red-500">❌ 오류: ${data.error}</span>`;
            renderSources(data.sources); 
        } else {
            loadingElement.classList.remove('loading-message');
            loadingElement.innerText = data.response;
            
            // 이미지 첨부가 없었으면 출처 표시 (RAG)
            if (!currentImageBase64) {
                renderSources(data.sources); 
            } else {
                chatbotSourceContainer.classList.add('hidden'); // 이미지 분석 시 출처 숨김
            }
        }

    } catch (err) {
        loadingElement.innerHTML = `<span class="text-red-500">❌ 네트워크 오류가 발생했습니다.</span>`;
        console.error("챗봇 API 호출 중 네트워크 오류:", err);
    } finally {
        sendChatBtn.disabled = false;
        removeImageBtn.disabled = false;
        
        // 이미지를 첨부해서 보냈다면, 전송 후 미리보기 제거
        if (currentImageBase64) {
            removeImagePreview();
        }
        scrollToBottom(chatMessagesContainer);
    }
}


// --------------------
// 이미지 첨부 및 제거 로직
// --------------------

// 파일이 선택되면 미리보기를 표시하고 Base64 저장
cameraInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            uploadedImageBase64 = e.target.result; 
            imagePreview.src = uploadedImageBase64;
            imagePreviewContainer.classList.remove('hidden');
            chatInput.placeholder = "이미지와 함께 질문하거나, 바로 전송하세요.";
        };
        reader.readAsDataURL(file); 
        event.target.value = null; 
    }
});

/**
 * 미리보기 이미지를 제거하고 Base64 변수를 초기화합니다.
 */
function removeImagePreview() {
    uploadedImageBase64 = null;
    imagePreview.src = '';
    imagePreviewContainer.classList.add('hidden');
    chatInput.placeholder = "분리수거에 대해 질문해 주세요...";
}


// --------------------
// 유틸리티 함수
// --------------------

/**
 * 메시지를 채팅창에 추가합니다. (이미지 첨부 상태 반영)
 */
function appendMessage(text, sender, isLoading = false, attachedImageBase64 = null) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add(
        sender === 'user' ? 'user-message' : 'chatbot-message', 
        'whitespace-pre-wrap'
    );
    
    let contentHTML = ``;
    
    if (attachedImageBase64 && sender === 'user') {
        // 사용자 메시지에 이미지가 첨부된 경우, 채팅 버블 내부에 이미지 삽입
        contentHTML += `<img src="${attachedImageBase64}" class="max-h-32 mb-2 rounded-lg" alt="첨부 이미지"/>`;
    }
    
    // 텍스트 내용 추가 (로딩 처리 포함)
    if (isLoading) {
        contentHTML += `<span class="animate-pulse">${text}</span>`;
        messageDiv.classList.add('loading-message'); 
    } else {
        contentHTML += text;
    }
    
    messageDiv.innerHTML = contentHTML;

    messageDiv.style.width = 'fit-content'; 
    
    if (sender === 'user') {
      messageDiv.style.alignSelf = 'flex-end';
    } else {
      messageDiv.style.alignSelf = 'flex-start';
    }

    chatMessagesContainer.appendChild(messageDiv);
    scrollToBottom(chatMessagesContainer);
    return messageDiv;
}

/**
 * 출처 정보를 화면에 표시합니다.
 */
function renderSources(sources) {
    sourceList.innerHTML = '';
    
    if (sources && sources.length > 0) {
        sources.forEach(source => {
            const sourceItem = document.createElement('div');
            sourceItem.innerHTML = `<a href="${source.url}" target="_blank" class="text-blue-600 hover:underline">${source.title}</a>`;
            sourceList.appendChild(sourceItem);
        });
        chatbotSourceContainer.classList.remove('hidden');
    } else {
        chatbotSourceContainer.classList.add('hidden');
    }
}

/**
 * 채팅 컨테이너를 가장 아래로 스크롤합니다.
 */
function scrollToBottom(container) {
    container.scrollTop = container.scrollHeight;
}


// --------------------
// 초기화
// --------------------
document.addEventListener('DOMContentLoaded', () => {
  const modalCloseBtn = document.getElementById("modal-close-btn");
  if(modalCloseBtn) {
    modalCloseBtn.addEventListener('click', closeModal);
  }
});