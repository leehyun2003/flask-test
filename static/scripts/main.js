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