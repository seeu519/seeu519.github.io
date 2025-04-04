document.addEventListener('DOMContentLoaded', () => {
  // ================ 新增主题配置 ================
  let currentTheme = localStorage.getItem('mapTheme') || 'light';
  const themes = {
    light: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }),
    dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© CARTO'
    })
  };

  // ================= 地图初始化 =================
  const map = L.map('map', {
    center: [0, 0],
    zoom: 13,
    layers: [themes[currentTheme]] // 使用动态主题
  });
  // ================= 路径规划功能（最终修复版） =================
let routingControl = null;
let startPoint = null;
let endPoint = null;
let activeMapClick = null;
let isSettingStart = false;
let isSettingEnd = false;

// 清除地图点击监听
function clearMapClickListener() {
  if (activeMapClick) {
    map.off('click', activeMapClick);
    activeMapClick = null;
  }
  isSettingStart = false;
  isSettingEnd = false;
}

function showStatus(message) {
  const statusBar = document.getElementById('route-status') || document.createElement('div');
  statusBar.id = 'route-status';
  statusBar.style.position = 'fixed';
  statusBar.style.bottom = '100px';
  statusBar.style.left = '50%';
  statusBar.style.transform = 'translateX(-50%)';
  statusBar.style.backgroundColor = 'rgba(255,255,255,0.9)';
  statusBar.style.padding = '8px 20px';
  statusBar.style.borderRadius = '20px';
  statusBar.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
  statusBar.textContent = message;
  document.body.appendChild(statusBar);
  
  setTimeout(() => {
    statusBar.remove();
  }, 2000);
}

document.body.addEventListener('click', e => {
  // 设起点
  if (e.target.classList.contains('btn-start')) {
    clearMapClickListener();
    isSettingStart = true;
    
    const input = prompt('输入起点坐标（格式：纬度,经度）\n或直接点击地图选择位置');
    if (input === null) {
      isSettingStart = false;
      return;
    }

    if (input.includes(',')) {
      const [lat, lng] = input.split(',').map(Number);
      if (isNaN(lat) || isNaN(lng)) {
        alert('坐标格式错误，请使用 纬度,经度 格式');
        isSettingStart = false;
        return;
      }
      startPoint = [lat, lng];
      showStatus(`✅ 起点已设置：${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    } else {
      activeMapClick = (mapEvent) => {
        startPoint = [mapEvent.latlng.lat, mapEvent.latlng.lng];
        showStatus(`✅ 起点已设置：${startPoint[0].toFixed(6)}, ${startPoint[1].toFixed(6)}`);
        clearMapClickListener();
      };
      map.on('click', activeMapClick);
      showStatus('🟡 请点击地图选择起点位置');
    }
  }

  // 设终点
  if (e.target.classList.contains('btn-end')) {
    clearMapClickListener();
    isSettingEnd = true;
    
    const input = prompt('输入终点坐标（格式：纬度,经度）\n或直接点击地图选择位置');
    if (input === null) {
      isSettingEnd = false;
      return;
    }

    if (input.includes(',')) {
      const [lat, lng] = input.split(',').map(Number);
      if (isNaN(lat) || isNaN(lng)) {
        alert('坐标格式错误，请使用 纬度,经度 格式');
        isSettingEnd = false;
        return;
      }
      endPoint = [lat, lng];
      showStatus(`✅ 终点已设置：${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    } else {
      activeMapClick = (mapEvent) => {
        endPoint = [mapEvent.latlng.lat, mapEvent.latlng.lng];
        showStatus(`✅ 终点已设置：${endPoint[0].toFixed(6)}, ${endPoint[1].toFixed(6)}`);
        clearMapClickListener();
      };
      map.on('click', activeMapClick);
      showStatus('🟡 请点击地图选择终点位置');
    }
  }

  // 清除路径
  if (e.target.classList.contains('btn-clear-route')) {
    if (routingControl) map.removeControl(routingControl);
    startPoint = endPoint = null;
    showStatus('🗑️ 已清除所有路径');
  }

  // 触发路径规划
  if (startPoint && endPoint) {
    try {
      initRouting(startPoint, endPoint);
      showStatus('🗺️ 路径规划成功！');
    } catch (error) {
      showStatus('❌ 路径规划失败，请检查起终点位置');
    }
  }
});
function initRouting(startCoords, endCoords) {
  if (routingControl) map.removeControl(routingControl);
  routingControl = L.Routing.control({
    waypoints: [
      L.latLng(startCoords[0], startCoords[1]),
      L.latLng(endCoords[0], endCoords[1])
    ],
    routeWhileDragging: true,
    collapsible: true
  }).addTo(map);
}
  // ================ 标记功能 ================
let markers = [];

// 地图点击事件监听（修复作用域）
map.on('click', function(e) {
    const popupContent = `
        <div class="marker-popup">
            <h4>自定义标记</h4>
            <input type="text" class="marker-title" placeholder="输入备注">
            <div class="marker-actions">
                <button class="btn-save">保存</button>
                <button class="btn-delete">删除</button>
            </div>
        </div>
    `;

    const newMarker = L.marker(e.latlng, {
        icon: L.divIcon({
            className: 'custom-marker',
            html: '📍',
            iconSize: [40, 40]
        }),
        draggable: true
    }).bindPopup(popupContent);

    // 修复右键事件
    newMarker.on('contextmenu', (e) => {
        e.originalEvent.preventDefault();
        map.removeLayer(newMarker);
        markers = markers.filter(m => m !== newMarker);
    });

    // 修复弹窗内元素选择器
    newMarker.on('popupopen', () => {
        const popupElement = newMarker.getPopup().getContent();
        popupElement.querySelector('.btn-save').addEventListener('click', () => {
            const title = popupElement.querySelector('.marker-title').value;
            newMarker.bindTooltip(title || '未命名地点').openTooltip();
        });
        
        popupElement.querySelector('.btn-delete').addEventListener('click', () => {
            map.removeLayer(newMarker);
            markers = markers.filter(m => m !== newMarker);
        });
    });

    markers.push(newMarker);
    newMarker.addTo(map);
});

// 创建标记管理工具
const markTools = document.createElement('div');
markTools.className = 'mark-tools';
markTools.innerHTML = `
    <button class="btn-clear">🗑️ 清除所有标记</button>
    <button class="btn-export-marks">📥 导出标记</button>
`;
document.body.appendChild(markTools);

// 修复事件绑定（使用事件委托）
document.body.addEventListener('click', (e) => {
    if(e.target.classList.contains('btn-clear')) {
        if(confirm('确定要删除所有标记吗？')) {
            markers.forEach(marker => map.removeLayer(marker));
            markers = [];
        }
    }
    
    if(e.target.classList.contains('btn-export-marks')) {
        const exportData = markers.map(marker => ({
            lat: marker.getLatLng().lat.toFixed(6),
            lng: marker.getLatLng().lng.toFixed(6),
            title: marker.getTooltip()?.getContent() || ''
        }));
        console.table(exportData);
        alert(`已导出 ${exportData.length} 个标记到控制台（F12查看）`);
    }
});

    //主题切换功能 
  document.querySelector('.btn-theme').addEventListener('click', () => {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    // 移除旧图层
    map.eachLayer(layer => {
      if (layer instanceof L.TileLayer) map.removeLayer(layer);
    });
    
    // 添加新主题
    themes[currentTheme].addTo(map);
    document.body.classList.toggle('dark-theme', currentTheme === 'dark');
    localStorage.setItem('mapTheme', currentTheme);
    
    // 更新按钮状态
    const themeBtn = document.querySelector('.btn-theme');
    themeBtn.textContent = currentTheme === 'light' ? '🌓 主题切换' : '🌞 主题切换';
  });

  // ================= 防抖函数定义 =================
  function debounce(func, delay) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), delay);
    };
  }

  // ================= 搜索功能 ================= 
const searchInput = document.getElementById('map-search-input');
const searchResults = document.querySelector('.search-results');

searchInput.addEventListener('input', debounce(async (e) => {
  const query = e.target.value.trim();
  if (!query) {
    searchResults.innerHTML = '';
    return;
  }

  try {
    const [geoData, wikiData] = await Promise.all([
      fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1`, {
        headers: { 'User-Agent': 'TimeTravelMap/1.0 (contact@yourdomain.com)' }
      }),
      fetch(`https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gsradius=50000&gslimit=5&origin=*&format=json&gssearch=${encodeURIComponent(query)}`)
    ]);

    const [geoResults, wikiResults] = await Promise.all([
      geoData.json(),
      wikiData.json()
    ]);

    // 数据处理
    const wikiProcessed = wikiResults.query?.geosearch?.map(item => ({
      ...item,
      lon: item.lng,
      lat: item.lat,
      display_name: item.title
    })) || [];

    const combinedResults = [...geoResults, ...wikiProcessed]
      .filter((v, i, a) => 
        a.findIndex(t => (
          Math.abs(t.lat - v.lat) < 0.0001 && 
          Math.abs(t.lon - v.lon) < 0.0001
        )) === i
      );

    // 获取详情
    const pageIds = wikiResults.query?.geosearch?.map(item => item.pageid) || [];
    const detailsRes = pageIds.length > 0 
      ? await fetch(`https://en.wikipedia.org/w/api.php?action=query&prop=extracts|pageimages|info&inprop=url&exintro&explaintext&pithumbsize=200&origin=*&format=json&pageids=${pageIds.join('|')}`)
      : { json: () => ({ query: { pages: {} } }) };
    
    const detailsData = await detailsRes.json();

    // 渲染结果
    searchResults.innerHTML = combinedResults.slice(0, 8).map(item => {
      const wikiInfo = detailsData.query?.pages?.[item.pageid];
      const isPOI = wikiInfo ? 'poi-item' : '';
      
      return `
        <div class="search-item ${isPOI}" 
             data-lat="${item.lat}" 
             data-lon="${item.lon}"
             onclick="flyToLocation(parseFloat('${item.lat}'), parseFloat('${item.lon}'))">
          ${wikiInfo?.thumbnail ? `
          <img class="poi-thumb" src="${wikiInfo.thumbnail.source}" alt="${wikiInfo.title}">` : ''}
          <div class="poi-info">
              <div class="name">${item.display_name || item.title}</div>
              ${item.type ? `<div class="type-tag">${item.type}</div>` : ''}
              ${wikiInfo?.extract ? `
              <div class="poi-description">
                  ${wikiInfo.extract.substring(0, 80)}...
              </div>` : ''}
          </div>
        </div>
      `;
    }).join('');
    
  } catch (error) {
    console.error('搜索请求失败:', error);
    searchResults.innerHTML = `
      <div class="search-error">
        ${error.message || '请求失败，请检查以下可能：<br>1. 网络连接<br>2. 特殊字符<br>3. API限制'}
      </div>
    `;
  }
}, 500)); // 防抖时间调整为500ms

  // ================= 定位功能 =================
  const locateBtn = document.querySelector('.btn-locate');
  
  locateBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
      alert("您的浏览器不支持地理定位功能");
      return;
    }

    locateBtn.disabled = true;
    locateBtn.classList.add('loading');
    locateBtn.textContent = '定位中...';

    navigator.geolocation.getCurrentPosition(
      position => {
        const userCoords = [position.coords.latitude, position.coords.longitude];
        map.flyTo(userCoords, 16, {
          duration: 1.5,
          easeLinearity: 0.3
        });

        if (window.userLocationMarker) {
          map.removeLayer(window.userLocationMarker);
        }
        
        window.userLocationMarker = L.marker(userCoords, {
          icon: L.divIcon({
            className: 'pulsing-marker',
            html: '<div class="pulse"></div>📍',
            iconSize: [40, 40]
          })
        }).addTo(map);

        locateBtn.textContent = '📍 我的位置';
        locateBtn.disabled = false;
        locateBtn.classList.remove('loading');
      },
      error => {
        console.error('定位失败:', error);
        alert(`无法获取位置：${error.message}`);
        locateBtn.textContent = '📍 我的位置';
        locateBtn.disabled = false;
        locateBtn.classList.remove('loading');
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );
  });

  // ================= 地图定位函数 =================
  window.flyToLocation = (lat, lon) => {
    map.flyTo([lat, lon], 14, {
      duration: 1.5,
      easeLinearity: 0.3
    });
  };

  //  主题初始化
  document.body.classList.toggle('dark-theme', currentTheme === 'dark');
  document.querySelector('.btn-theme').textContent = 
    currentTheme === 'light' ? '🌓 主题切换' : '🌞 主题切换';
});

// ================= 动态样式 =================
const style = document.createElement('style');
style.textContent = `
  .pulsing-marker {
    transform-origin: center;
    animation: pulse 1.5s infinite;
  }
  
  @keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.2); }
    100% { transform: scale(1); }
  }
  
  .pulse {
    position: absolute;
    width: 40px;
    height: 40px;
    background: #2196F3;
    border-radius: 50%;
    opacity: 0.3;
    animation: ripple 2s infinite;
  }
  
  @keyframes ripple {
    0% { transform: scale(0.5); opacity: 0.3; }
    100% { transform: scale(2); opacity: 0; }
  }
`;
document.head.appendChild(style);

