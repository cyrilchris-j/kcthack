/* ═══════════════════════════════════════════════════════════
   E-WASTE INTELLIGENCE SYSTEM — JavaScript Application
   ═══════════════════════════════════════════════════════════ */

const API = '/api';  // served by Flask on port 5001

// ──────────────────────────────────────────────────────────
// Utility helpers
// ──────────────────────────────────────────────────────────
function showLoading() { document.getElementById('loading-overlay').classList.add('active'); }
function hideLoading() { document.getElementById('loading-overlay').classList.remove('active'); }

async function apiFetch(path, options = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

// Clock
function updateClock() {
  const el = document.getElementById('current-time');
  if (el) el.textContent = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
setInterval(updateClock, 1000);
updateClock();

// Health check
async function checkApiHealth() {
  const dot  = document.querySelector('.status-dot');
  const text = document.querySelector('.status-text');
  try {
    await apiFetch('/health');
    dot.className  = 'status-dot online';
    text.textContent = 'API Online';
  } catch {
    dot.className  = 'status-dot offline';
    text.textContent = 'API Offline';
  }
}
checkApiHealth();
setInterval(checkApiHealth, 30000);

// ──────────────────────────────────────────────────────────
// Navigation
// ──────────────────────────────────────────────────────────
const TAB_INFO = {
  dashboard: { title: 'Overview Dashboard',        subtitle: 'Real-time e-waste intelligence across India' },
  forecast:  { title: 'E-Waste Forecast Engine',   subtitle: 'AI-generated projections through 2040' },
  map:       { title: 'GIS Hotspot Analysis',       subtitle: 'Interactive geographic waste distribution map' },
  predict:   { title: 'AI Prediction Engine',       subtitle: 'Real-time machine learning predictions' },
  scenario:  { title: 'Scenario Simulation',        subtitle: 'Model future trajectories under different policies' },
  cities:    { title: 'Top E-Waste Cities',          subtitle: 'City-level rankings and risk assessment' },
  solutions: { title: 'Policy Recommendations',     subtitle: 'AI-driven actionable solutions by city risk level' },
  about:     { title: 'About This Project',          subtitle: 'Problem statement, solution overview & data sources' },
};

function switchTab(tabId) {
  // Update panels
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-' + tabId).classList.add('active');

  // Update nav
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navEl = document.getElementById('nav-' + tabId);
  if (navEl) navEl.classList.add('active');

  // Update topbar
  const info = TAB_INFO[tabId];
  document.getElementById('page-title').textContent    = info.title;
  document.getElementById('page-subtitle').textContent = info.subtitle;

  // Lazy-load tab content
  if (tabId === 'map' && !window._mapLoaded) { initMainMap(); window._mapLoaded = true; }
  if (tabId === 'forecast') loadForecast();
  if (tabId === 'scenario' && !window._scenarioRan) { runScenario(); window._scenarioRan = true; }
  if (tabId === 'cities') loadCitiesYear(+document.querySelector('.year-tab.active')?.textContent || 2024);
  if (tabId === 'solutions' && !window._solutionsLoaded) { loadSolutions(); window._solutionsLoaded = true; }
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    switchTab(item.dataset.tab);
    // Mobile: close sidebar
    if (window.innerWidth < 900) document.getElementById('sidebar').classList.remove('open');
  });
});

document.getElementById('sidebar-toggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

function onYearChange() {
  const year = +document.getElementById('global-year').value;
  loadDashboard(year);
}

// ──────────────────────────────────────────────────────────
// Charts registry
// ──────────────────────────────────────────────────────────
const charts = {};

function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

// Chart.js global defaults
Chart.defaults.color = '#7b9cc9';
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.plugins.legend.display = false;

// ──────────────────────────────────────────────────────────
// Dashboard
// ──────────────────────────────────────────────────────────
async function loadDashboard(year = 2024) {
  try {
    const [forecastData, citiesData, topData] = await Promise.all([
      apiFetch('/forecast?population=1.4&device_rate=0.5'),
      apiFetch('/cities?year=' + year),
      apiFetch('/top-cities?year=' + year)
    ]);

    updateKPIs(forecastData, citiesData, topData, year);
    renderDashboardForecastChart(forecastData);
    renderRiskChart(citiesData);
    renderDashboardMap(citiesData);
    renderTop3(topData.top_cities, year);

  } catch (err) {
    console.error('Dashboard load error:', err);
  }
}

function updateKPIs(forecastData, citiesData, topData, year) {
  const yearData = forecastData.forecast.find(f => f.year === year) || {};
  const prevData = forecastData.forecast.find(f => f.year === year - 1) || {};

  const total = yearData.waste || 0;
  const prev  = prevData.waste || 0;
  const delta = prev ? (((total - prev) / prev) * 100).toFixed(1) : 0;

  document.getElementById('kpi-total-val').textContent   = total.toFixed(1);
  document.getElementById('kpi-total-delta').textContent = `↑ +${delta}% vs ${year - 1}`;
  document.getElementById('kpi-hotspot-val').textContent = topData[0]?.name || '—';
  document.getElementById('top3-year-label').textContent = year + ' rankings';

  // Dynamic recycling rate from API
  if (citiesData.avg_recycling_rate) {
    const rate = (citiesData.avg_recycling_rate * 100).toFixed(1);
    document.querySelector('#kpi-recycling .kpi-value').textContent = rate + '%';
  }
}

function renderDashboardForecastChart(data) {
  destroyChart('forecastChart');
  const ctx = document.getElementById('forecastChart').getContext('2d');

  const labels = data.forecast.map(d => d.year);
  const vals   = data.forecast.map(d => d.waste);
  const splitIdx = data.forecast.findIndex(d => d.is_forecast);

  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, 'rgba(61,142,248,0.3)');
  gradient.addColorStop(1, 'rgba(61,142,248,0)');

  const gradientFc = ctx.createLinearGradient(0, 0, 0, 300);
  gradientFc.addColorStop(0, 'rgba(139,92,246,0.25)');
  gradientFc.addColorStop(1, 'rgba(139,92,246,0)');

  charts['forecastChart'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Historical',
          data: vals.map((v, i) => i < splitIdx ? v : null),
          borderColor: '#3d8ef8',
          backgroundColor: gradient,
          borderWidth: 2.5,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: '#3d8ef8',
          pointBorderColor: '#060b14',
          pointBorderWidth: 2,
        },
        {
          label: 'Forecast',
          data: vals.map((v, i) => i >= splitIdx - 1 ? v : null),
          borderColor: '#8b5cf6',
          backgroundColor: gradientFc,
          borderWidth: 2.5,
          fill: true,
          tension: 0.4,
          borderDash: [6, 3],
          pointRadius: 4,
          pointBackgroundColor: '#8b5cf6',
          pointBorderColor: '#060b14',
          pointBorderWidth: 2,
        }
      ]
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        tooltip: {
          backgroundColor: '#0d1626',
          borderColor: 'rgba(99,148,255,0.2)',
          borderWidth: 1,
          titleColor: '#e8f0ff',
          bodyColor: '#7b9cc9',
          padding: 12,
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(2) || '—'} MMT`
          }
        }
      },
      scales: {
        x: { grid: { color: 'rgba(99,148,255,0.05)', drawBorder: false }, ticks: { maxTicksLimit: 10 } },
        y: { grid: { color: 'rgba(99,148,255,0.08)', drawBorder: false }, ticks: { callback: v => v + ' MMT' } }
      }
    }
  });
}

function renderRiskChart(data) {
  destroyChart('riskChart');
  const ctx = document.getElementById('riskChart').getContext('2d');
  const counts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  data.cities.forEach(c => counts[c.risk_level]++);

  charts['riskChart'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Critical', 'High', 'Medium', 'Low'],
      datasets: [{
        data: Object.values(counts),
        backgroundColor: ['#ef4444', '#f59e0b', '#3d8ef8', '#10b981'],
        borderColor: '#0d1626',
        borderWidth: 3,
        hoverOffset: 8,
      }]
    },
    options: {
      cutout: '70%',
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: { padding: 14, generateLabels: chart => {
            const data = chart.data;
            return data.labels.map((label, i) => ({
              text: `${label}: ${data.datasets[0].data[i]}`,
              fillStyle: data.datasets[0].backgroundColor[i],
              index: i
            }));
          }}
        },
        tooltip: {
          backgroundColor: '#0d1626',
          borderColor: 'rgba(99,148,255,0.2)',
          borderWidth: 1,
          callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed} cities` }
        }
      }
    }
  });
}

// ──────────────────────────────────────────────────────────
// Dashboard Mini Map
// ──────────────────────────────────────────────────────────
let dashMap = null;
let dashHeat = null;

async function renderDashboardMap(citiesData) {
  if (!dashMap) {
    dashMap = L.map('dashboard-map', {
      center: [20.5937, 78.9629],
      zoom: 4,
      zoomControl: true,
      scrollWheelZoom: false,
      attributionControl: false
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© CARTO',
      maxZoom: 18
    }).addTo(dashMap);
  }

  if (dashHeat) dashMap.removeLayer(dashHeat);

  const heatData = citiesData.cities.map(c => [c.lat, c.lng, c.intensity]);
  dashHeat = L.heatLayer(heatData, {
    radius: 40,
    blur: 25,
    maxZoom: 10,
    gradient: { 0.2: '#10b981', 0.5: '#f59e0b', 0.8: '#ef4444', 1.0: '#e11d48' }
  }).addTo(dashMap);
}

// ──────────────────────────────────────────────────────────
// Top 3 Widget
// ──────────────────────────────────────────────────────────
function renderTop3(cities, year) {
  const container = document.getElementById('top3-list');
  container.innerHTML = '';
  cities.slice(0, 5).forEach((city, i) => {
    const div = document.createElement('div');
    div.className = 'top3-item';
    div.innerHTML = `
      <div class="top3-rank rank-${i + 1}">${i + 1}</div>
      <div class="top3-name">${city.name}</div>
      <div class="top3-waste">${city.waste_kt} kt</div>
    `;
    container.appendChild(div);
  });
}

// ──────────────────────────────────────────────────────────
// Forecast Tab
// ──────────────────────────────────────────────────────────
function updateForecastControls() {
  const pop    = +document.getElementById('fc-population').value;
  const device = +document.getElementById('fc-device').value;
  document.getElementById('fc-pop-val').textContent    = pop.toFixed(1) + 'B';
  document.getElementById('fc-device-val').textContent = (device * 100).toFixed(0) + '%';
}

async function loadForecast() {
  const pop    = +document.getElementById('fc-population').value;
  const device = +document.getElementById('fc-device').value;

  try {
    const data = await apiFetch(`/forecast?population=${pop}&device_rate=${device}`);
    renderFullForecastChart(data);
    renderForecastStats(data);
  } catch (err) {
    console.error('Forecast load error:', err);
  }
}

function renderFullForecastChart(data) {
  destroyChart('fullForecastChart');
  const ctx = document.getElementById('fullForecastChart').getContext('2d');

  const labels   = data.forecast.map(d => d.year);
  const vals     = data.forecast.map(d => d.waste);
  const splitIdx = data.forecast.findIndex(d => d.is_forecast);

  const gradH = ctx.createLinearGradient(0, 0, 0, 400);
  gradH.addColorStop(0, 'rgba(61,142,248,0.25)');
  gradH.addColorStop(1, 'transparent');

  const gradF = ctx.createLinearGradient(0, 0, 0, 400);
  gradF.addColorStop(0, 'rgba(139,92,246,0.2)');
  gradF.addColorStop(1, 'transparent');

  charts['fullForecastChart'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Actual / Estimated',
          data: vals.map((v, i) => i < splitIdx ? v : null),
          borderColor: '#3d8ef8',
          backgroundColor: gradH,
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointRadius: 5,
          pointBackgroundColor: '#3d8ef8',
          pointBorderColor: '#060b14',
          pointBorderWidth: 2,
        },
        {
          label: 'AI Forecast',
          data: vals.map((v, i) => i >= splitIdx - 1 ? v : null),
          borderColor: '#8b5cf6',
          backgroundColor: gradF,
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          borderDash: [8, 4],
          pointRadius: 4,
          pointBackgroundColor: '#8b5cf6',
          pointBorderColor: '#060b14',
          pointBorderWidth: 2,
        }
      ]
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        tooltip: {
          backgroundColor: '#13203a',
          borderColor: 'rgba(99,148,255,0.2)',
          borderWidth: 1,
          titleColor: '#e8f0ff',
          bodyColor: '#7b9cc9',
          padding: 14,
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(2) || '—'} MMT`
          }
        },
        annotation: {
          annotations: {
            splitLine: {
              type: 'line',
              xMin: splitIdx - 1,
              xMax: splitIdx - 1,
              borderColor: 'rgba(139,92,246,0.5)',
              borderWidth: 2,
              borderDash: [5, 5],
              label: {
                content: '← Forecast Begins',
                display: true,
                color: '#8b5cf6',
                position: 'start',
                backgroundColor: 'rgba(139,92,246,0.1)',
                font: { size: 11, weight: '600' },
                padding: { x: 8, y: 4 }
              }
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(99,148,255,0.06)', drawBorder: false },
          ticks: { maxTicksLimit: 12 }
        },
        y: {
          grid: { color: 'rgba(99,148,255,0.08)', drawBorder: false },
          ticks: { callback: v => v + ' MMT' },
          title: { display: true, text: 'Million Metric Tons', color: '#4a6280' }
        }
      }
    }
  });
}

function renderForecastStats(data) {
  const forecast = data.forecast;
  const current  = forecast.find(f => f.year === 2024) || {};
  const mid      = forecast.find(f => f.year === 2030) || {};
  const end      = forecast.find(f => f.year === 2040) || {};

  const growth3040 = mid.waste ? (((end.waste - mid.waste) / mid.waste) * 100).toFixed(1) : 0;

  document.getElementById('forecast-stats').innerHTML = `
    <div class="stat-card">
      <div class="stat-num">${current.waste?.toFixed(1) || '—'}</div>
      <div class="stat-label">2024 Baseline (MMT)</div>
    </div>
    <div class="stat-card">
      <div class="stat-num">${mid.waste?.toFixed(1) || '—'}</div>
      <div class="stat-label">2030 Projected (MMT)</div>
    </div>
    <div class="stat-card">
      <div class="stat-num">${end.waste?.toFixed(1) || '—'}</div>
      <div class="stat-label">2040 Projected (MMT)</div>
    </div>
  `;
}

// ──────────────────────────────────────────────────────────
// Main Map (GIS Tab)
// ──────────────────────────────────────────────────────────
let mainMap = null;
let mainHeatLayer = null;
let mainMarkers = [];

function initMainMap() {
  mainMap = L.map('main-map', {
    center: [20.5937, 78.9629],
    zoom: 5,
    zoomControl: true,
    attributionControl: false
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_matter_no_labels/{z}/{x}/{y}{r}.png', {
    attribution: '© CARTO',
    maxZoom: 18
  }).addTo(mainMap);

  loadMapData();
}

async function loadMapData() {
  if (!mainMap) return;
  const year = +document.getElementById('map-year').value;
  const mode = document.getElementById('map-mode').value;

  try {
    const data = await apiFetch('/cities?year=' + year);

    // Clear existing
    if (mainHeatLayer) mainMap.removeLayer(mainHeatLayer);
    mainMarkers.forEach(m => mainMap.removeLayer(m));
    mainMarkers = [];

    // Populate quick list
    const quickList = document.getElementById('city-quick-list');
    quickList.innerHTML = '';

    if (mode === 'heat' || mode === 'both') {
      const heatData = data.cities.map(c => [c.lat, c.lng, c.intensity]);
      mainHeatLayer = L.heatLayer(heatData, {
        radius: 55,
        blur: 30,
        maxZoom: 12,
        gradient: { 0.2: '#1d4ed8', 0.4: '#10b981', 0.6: '#f59e0b', 0.8: '#ef4444', 1.0: '#e11d48' }
      }).addTo(mainMap);
    }

    if (mode === 'markers' || mode === 'both') {
      data.cities.forEach(city => {
        const color = city.risk_level === 'Critical' ? '#ef4444' :
                      city.risk_level === 'High'     ? '#f59e0b' :
                      city.risk_level === 'Medium'   ? '#3d8ef8' : '#10b981';

        const icon = L.divIcon({
          className: '',
          html: `<div style="
            width:14px; height:14px; border-radius:50%;
            background:${color};
            border:3px solid rgba(255,255,255,0.4);
            box-shadow:0 0 10px ${color}80;
          "></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7]
        });

        const marker = L.marker([city.lat, city.lng], { icon })
          .addTo(mainMap)
          .bindPopup(`
            <div class="popup-title">${city.name}</div>
            <div class="popup-row"><span>E-Waste</span><span class="popup-val">${city.waste_kt} kt</span></div>
            <div class="popup-row"><span>Population</span><span class="popup-val">${city.population}M</span></div>
            <div class="popup-row"><span>Device Rate</span><span class="popup-val">${(city.device_rate * 100).toFixed(0)}%</span></div>
            <div class="popup-row"><span>Risk Level</span><span class="popup-val" style="color:${color}">${city.risk_level}</span></div>
          `, { maxWidth: 240 })
          .on('click', () => showCityDetail(city, color));

        mainMarkers.push(marker);

        // Quick list
        const item = document.createElement('div');
        item.className = 'city-quick-item';
        item.innerHTML = `
          <span class="city-quick-name">${city.name}</span>
          <span class="city-quick-waste">${city.waste_kt} kt</span>
        `;
        item.onclick = () => { mainMap.setView([city.lat, city.lng], 7); showCityDetail(city, color); };
        quickList.appendChild(item);
      });
    }

  } catch (err) {
    console.error('Map load error:', err);
  }
}

function showCityDetail(city, color = '#3d8ef8') {
  const panel = document.getElementById('city-detail-panel');
  const riskClass = 'risk-' + city.risk_level;
  panel.innerHTML = `
    <div style="margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
      <div style="font-family:'Space Grotesk',sans-serif; font-size:16px; font-weight:700;">${city.name}</div>
      <span class="risk-badge ${riskClass}">${city.risk_level}</span>
    </div>
    <div style="width:100%; height:3px; background:linear-gradient(90deg,${color},transparent); border-radius:2px; margin-bottom:14px;"></div>
    <div style="display:flex; flex-direction:column; gap:8px; font-size:13px;">
      <div style="display:flex; justify-content:space-between;">
        <span style="color:var(--text-muted)">E-Waste</span>
        <span style="font-weight:700; color:var(--warning)">${city.waste_kt} kt</span>
      </div>
      <div style="display:flex; justify-content:space-between;">
        <span style="color:var(--text-muted)">Population</span>
        <span style="font-weight:600;">${city.population}M</span>
      </div>
      <div style="display:flex; justify-content:space-between;">
        <span style="color:var(--text-muted)">Device Rate</span>
        <span style="font-weight:600;">${(city.device_rate * 100).toFixed(0)}%</span>
      </div>
      <div style="display:flex; justify-content:space-between;">
        <span style="color:var(--text-muted)">Intensity</span>
        <span style="font-weight:600;">${(city.intensity * 100).toFixed(1)}%</span>
      </div>
    </div>
    <div style="margin-top:12px; height:6px; background:var(--bg-elevated); border-radius:4px; overflow:hidden;">
      <div style="width:${city.intensity * 100}%; height:100%; background:linear-gradient(90deg,#10b981,${color}); border-radius:4px;"></div>
    </div>
  `;
}

// ──────────────────────────────────────────────────────────
// AI Predictor Tab
// ──────────────────────────────────────────────────────────
let _lastPrediction = null;

async function runPrediction() {
  const pop    = +document.getElementById('pred-population').value;
  const device = +document.getElementById('pred-device-rate').value;
  const year   = +document.getElementById('pred-year').value;

  if (!pop || !device || !year) return alert('Please fill all fields');
  if (device < 0 || device > 1) return alert('Device rate must be between 0 and 1');

  showLoading();
  try {
    const data = await apiFetch('/predict', {
      method: 'POST',
      body: JSON.stringify({ population: pop, device_rate: device, year })
    });

    _lastPrediction = data;
    document.getElementById('export-pred-btn').style.display = 'flex';

    document.getElementById('result-placeholder').style.display = 'none';
    document.getElementById('result-data').style.display = 'block';

    document.getElementById('result-value').textContent = data.predicted_waste_mmt.toFixed(2);
    document.getElementById('conf-lower').textContent   = data.confidence_lower;
    document.getElementById('conf-upper').textContent   = data.confidence_upper;
    document.getElementById('result-year-label').textContent   = 'Year: ' + data.year;
    document.getElementById('result-pop-label').textContent    = 'Population: ' + data.population + 'M';
    document.getElementById('result-device-label').textContent = 'Device Rate: ' + (data.device_rate * 100).toFixed(0) + '%';

    // Insight
    const level  = data.predicted_waste_mmt > 70 ? 'critically high' : data.predicted_waste_mmt > 55 ? 'high' : 'moderate';
    const action = data.predicted_waste_mmt > 70
      ? 'Immediate policy intervention and infrastructure investment are essential.'
      : data.predicted_waste_mmt > 55
      ? 'Strong recycling programs and e-waste collection drives are recommended.'
      : 'Continue current recycling initiatives and monitor trends closely.';

    document.getElementById('result-insight').innerHTML = `
      <i class="fa-solid fa-lightbulb" style="color:var(--warning); margin-right:6px;"></i>
      Predicted e-waste level is <strong>${level}</strong> for ${year}. ${action}
    `;

  } catch (err) {
    alert('Prediction failed. Is the backend running?');
  } finally {
    hideLoading();
  }
}

// ──────────────────────────────────────────────────────────
// Scenario Simulation Tab
// ──────────────────────────────────────────────────────────
async function runScenario() {
  const payload = {
    population:    +document.getElementById('sim-pop').value,
    device_rate:   +document.getElementById('sim-device').value,
    growth_rate:   +document.getElementById('sim-growth').value,
    adoption_rate: +document.getElementById('sim-adoption').value,
    recycling_rate:+document.getElementById('sim-recycling').value,
    start_year:    2024,
    end_year:      +document.getElementById('sim-end-year').value
  };

  showLoading();
  try {
    const data = await apiFetch('/scenario', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    renderScenarioChart(data);
    renderScenarioSummary(data);
  } catch (err) {
    alert('Scenario simulation failed. Is the backend running?');
  } finally {
    hideLoading();
  }
}

function renderScenarioChart(data) {
  destroyChart('scenarioChart');
  const ctx = document.getElementById('scenarioChart').getContext('2d');

  const labels = data.scenarios.baseline.map(d => d.year);
  const mkGrad = (top, bot) => {
    const g = ctx.createLinearGradient(0, 0, 0, 400);
    g.addColorStop(0, top); g.addColorStop(1, bot);
    return g;
  };

  charts['scenarioChart'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Optimistic',
          data: data.scenarios.optimistic.map(d => d.waste),
          borderColor: '#10b981',
          backgroundColor: mkGrad('rgba(16,185,129,0.15)', 'transparent'),
          fill: true, tension: 0.4, borderWidth: 2.5,
          pointRadius: 3, pointBackgroundColor: '#10b981',
        },
        {
          label: 'Baseline',
          data: data.scenarios.baseline.map(d => d.waste),
          borderColor: '#f59e0b',
          backgroundColor: mkGrad('rgba(245,158,11,0.12)', 'transparent'),
          fill: true, tension: 0.4, borderWidth: 2.5,
          pointRadius: 3, pointBackgroundColor: '#f59e0b',
        },
        {
          label: 'Pessimistic',
          data: data.scenarios.pessimistic.map(d => d.waste),
          borderColor: '#ef4444',
          backgroundColor: mkGrad('rgba(239,68,68,0.12)', 'transparent'),
          fill: true, tension: 0.4, borderWidth: 2.5,
          pointRadius: 3, pointBackgroundColor: '#ef4444',
        }
      ]
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: true, position: 'top', labels: { padding: 16, usePointStyle: true } },
        tooltip: {
          backgroundColor: '#13203a',
          borderColor: 'rgba(99,148,255,0.2)',
          borderWidth: 1,
          titleColor: '#e8f0ff',
          bodyColor: '#7b9cc9',
          padding: 14,
          callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)} MMT` }
        }
      },
      scales: {
        x: { grid: { color: 'rgba(99,148,255,0.05)' } },
        y: {
          grid: { color: 'rgba(99,148,255,0.08)' },
          ticks: { callback: v => v + ' MMT' },
          title: { display: true, text: 'MMT (net of recycling)', color: '#4a6280' }
        }
      }
    }
  });
}

function renderScenarioSummary(data) {
  const lastOf = arr => arr[arr.length - 1]?.waste ?? 0;
  const endYr  = document.getElementById('sim-end-year').value;

  document.getElementById('scenario-summary').innerHTML = `
    <div class="scenario-sum-card optimistic">
      <div class="sum-label">Optimistic</div>
      <div class="sum-val">${lastOf(data.scenarios.optimistic).toFixed(1)}</div>
      <div class="sum-desc">MMT by ${endYr}<br>Higher recycling adoption</div>
    </div>
    <div class="scenario-sum-card baseline">
      <div class="sum-label">Baseline</div>
      <div class="sum-val">${lastOf(data.scenarios.baseline).toFixed(1)}</div>
      <div class="sum-desc">MMT by ${endYr}<br>Current policy trajectory</div>
    </div>
    <div class="scenario-sum-card pessimistic">
      <div class="sum-label">Pessimistic</div>
      <div class="sum-val">${lastOf(data.scenarios.pessimistic).toFixed(1)}</div>
      <div class="sum-desc">MMT by ${endYr}<br>Delayed action scenario</div>
    </div>
  `;
}

// ──────────────────────────────────────────────────────────
// Top Cities Tab
// ──────────────────────────────────────────────────────────
let _lastCitiesData = null;
let _lastCitiesYear = 2024;

async function loadCitiesYear(year, btn) {
  if (btn) {
    document.querySelectorAll('.year-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
  }

  _lastCitiesYear = year;
  showLoading();
  try {
    const data = await apiFetch('/cities?year=' + year);
    _lastCitiesData = data.cities;
    document.getElementById('cities-count-label').textContent = `${data.cities.length} cities — ${year} projections`;
    renderPodium(data.cities.slice(0, 3));
    renderCitiesTable(data.cities, year);
    renderCityBarChart(data.cities);
  } catch (err) {
    alert('Failed to load city data.');
  } finally {
    hideLoading();
  }
}

function renderPodium(top3) {
  const order = [top3[1], top3[0], top3[2]]; // 2nd, 1st, 3rd
  const posClasses = ['podium-2', 'podium-1', 'podium-3'];
  const ranks = ['2', '1', '3'];
  const heights = ['75px', '100px', '60px'];

  document.getElementById('cities-podium').innerHTML = order.map((city, i) => `
    <div class="podium-item">
      <div class="podium-badge ${posClasses[i]}">${ranks[i]}</div>
      <div style="font-weight:700; font-size:13px; text-align:center; margin-bottom:4px;">${city?.name || '—'}</div>
      <div style="font-size:12px; color:var(--warning); margin-bottom:6px; font-weight:700;">${city?.waste_kt || 0} kt</div>
      <div class="podium-platform ${posClasses[i]}" style="height:${heights[i]};width:90px;"></div>
    </div>
  `).join('');
}

function renderCitiesTable(cities, year) {
  const body = document.getElementById('cities-table-body');
  const riskColors = { Critical: '#ef4444', High: '#f59e0b', Medium: '#3d8ef8', Low: '#10b981' };
  const trends = ['↑↑', '↑', '↑', '→', '↑', '↑', '↑', '→', '↑', '→', '↑', '→', '↑', '↑', '↑'];

  body.innerHTML = cities.map((city, i) => `
    <tr>
      <td class="rank-cell">#${i + 1}</td>
      <td class="city-name-cell">${city.name}</td>
      <td class="waste-cell">${city.waste_kt}</td>
      <td>${city.population}M</td>
      <td>${(city.device_rate * 100).toFixed(0)}%</td>
      <td style="color:${riskColors[city.risk_level] || '#7b9cc9'}; font-weight:700;">${city.recycling_rate ? (city.recycling_rate * 100).toFixed(0) + '%' : '—'}</td>
      <td><span class="risk-badge risk-${city.risk_level}">${city.risk_level}</span></td>
      <td style="color:${riskColors[city.risk_level]}; font-weight:700;">${trends[i]}</td>
    </tr>
  `).join('');
}

function renderCityBarChart(cities) {
  destroyChart('cityBarChart');
  const ctx = document.getElementById('cityBarChart').getContext('2d');

  const riskColors = {
    Critical: 'rgba(239,68,68,0.8)',
    High:     'rgba(245,158,11,0.8)',
    Medium:   'rgba(61,142,248,0.8)',
    Low:      'rgba(16,185,129,0.8)'
  };

  charts['cityBarChart'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: cities.map(c => c.name),
      datasets: [{
        label: 'E-Waste (kt)',
        data: cities.map(c => c.waste_kt),
        backgroundColor: cities.map(c => riskColors[c.risk_level]),
        borderColor: cities.map(c => riskColors[c.risk_level].replace('0.8', '1')),
        borderWidth: 1,
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        tooltip: {
          backgroundColor: '#13203a',
          borderColor: 'rgba(99,148,255,0.2)',
          borderWidth: 1,
          titleColor: '#e8f0ff',
          bodyColor: '#7b9cc9',
          padding: 12,
          callbacks: { label: ctx => ` E-Waste: ${ctx.parsed.y} kt` }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          grid: { color: 'rgba(99,148,255,0.08)' },
          ticks: { callback: v => v + ' kt' }
        }
      }
    }
  });
}

// ──────────────────────────────────────────────────────────
// Bootstrap on load
// ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadDashboard(2024);
  // Pre-initialize forecast controls display
  updateForecastControls();
});

// ──────────────────────────────────────────────────────────
// Solutions Tab
// ──────────────────────────────────────────────────────────
const RECOMMENDATIONS = {
  Critical: {
    color: '#ef4444',
    icon: 'fa-fire',
    actions: [
      { icon: 'fa-building',        text: 'Establish 50+ authorized e-waste collection centers with GPS-tracked pickups across all city wards' },
      { icon: 'fa-industry',        text: 'Mandate quarterly EPR compliance audits for all electronics OEMs — enforce ₹50,000/ton penalty for shortfall' },
      { icon: 'fa-truck',           text: 'Launch door-to-door e-waste collection drives in all residential zones, monthly frequency' },
      { icon: 'fa-certificate',     text: 'Certify and formalize informal recycling units with safety training and fair trade certification' },
      { icon: 'fa-chart-bar',       text: 'Deploy real-time e-waste monitoring dashboards for municipal corporations with monthly reporting' },
    ],
    impact: '↓ 25–35% waste in landfills within 3 years under strict enforcement'
  },
  High: {
    color: '#f59e0b',
    icon: 'fa-triangle-exclamation',
    actions: [
      { icon: 'fa-mobile',          text: 'Mobile e-waste collection drives every 2 months in residential areas and tech parks' },
      { icon: 'fa-school',          text: 'Mandatory e-waste awareness programs in schools, colleges and corporate campuses' },
      { icon: 'fa-building-columns',text: 'Partner with corporate offices for signed bulk e-waste collection agreements annually' },
      { icon: 'fa-coins',           text: 'Implement cash-for-devices buyback incentive scheme at municipal level via app' },
    ],
    impact: '↓ 15–20% diversion from informal to formal recycling sector'
  },
  Medium: {
    color: '#3d8ef8',
    icon: 'fa-circle-info',
    actions: [
      { icon: 'fa-map-pin',         text: 'Install e-waste drop-off kiosks in malls, apartment complexes, and RWA offices' },
      { icon: 'fa-megaphone',       text: 'Run public awareness campaigns on digital platforms and cable TV channels' },
      { icon: 'fa-recycle',         text: 'Promote manufacturer-led refurbishment and buy-back programs at point of sale' },
    ],
    impact: '↓ Prevent 10% annual waste increase, maintain Medium risk classification'
  },
  Low: {
    color: '#10b981',
    icon: 'fa-circle-check',
    actions: [
      { icon: 'fa-eye',             text: 'Maintain quarterly e-waste generation assessments with published public reports' },
      { icon: 'fa-handshake',       text: 'Share governance best practices with High and Critical risk cities via MoU' },
      { icon: 'fa-seedling',        text: 'Pilot cutting-edge circular economy models: repair cafes, device libraries, material recovery' },
    ],
    impact: '✓ Sustain below 30% intensity threshold — model city for national replication'
  }
};

async function loadSolutions() {
  try {
    const data = await apiFetch('/cities?year=2024');
    const cities = data.cities;

    const totalWaste = cities.reduce((s, c) => s + c.waste_kt, 0);
    const criticalCities = cities.filter(c => c.risk_level === 'Critical');

    document.getElementById('sol-total-waste').textContent    = Math.round(totalWaste).toLocaleString('en-IN') + ' kt';
    document.getElementById('sol-critical-count').textContent = criticalCities.length;
    if (data.avg_recycling_rate) {
      document.getElementById('sol-avg-recycling').textContent = (data.avg_recycling_rate * 100).toFixed(1) + '%';
    }

    renderSolutionsGrid(cities);
  } catch (err) {
    console.error('Solutions load error:', err);
  }
}

function renderSolutionsGrid(cities) {
  const grid = document.getElementById('solutions-grid');
  const byRisk = { Critical: [], High: [], Medium: [], Low: [] };
  cities.forEach(c => { if (byRisk[c.risk_level]) byRisk[c.risk_level].push(c); });

  grid.innerHTML = Object.entries(byRisk).map(([risk, citiesInRisk]) => {
    const rec = RECOMMENDATIONS[risk];
    if (!citiesInRisk.length) return '';

    const cityTags = citiesInRisk.map(c =>
      `<span class="city-tag">${c.name} <span class="city-tag-waste">${c.waste_kt}kt</span></span>`
    ).join('');

    const actions = rec.actions.map(a =>
      `<div class="solution-action-item">
        <i class="fa-solid ${a.icon}" style="color:${rec.color};width:16px;flex-shrink:0;"></i>
        <span>${a.text}</span>
      </div>`
    ).join('');

    return `
      <div class="solution-card" style="border-top: 3px solid ${rec.color};">
        <div class="solution-card-header">
          <div class="solution-risk-badge" style="background:${rec.color}18;color:${rec.color};border:1px solid ${rec.color}35;">
            <i class="fa-solid ${rec.icon}"></i> ${risk} Risk
          </div>
          <div class="solution-cities">${cityTags}</div>
        </div>
        <div class="solution-actions">${actions}</div>
        <div class="solution-impact" style="border-left:3px solid ${rec.color};">
          <i class="fa-solid fa-bullseye" style="color:${rec.color};margin-right:6px;"></i>
          <strong>Expected Impact:</strong> ${rec.impact}
        </div>
      </div>
    `;
  }).join('');
}

// ──────────────────────────────────────────────────────────
// Export Functions
// ──────────────────────────────────────────────────────────
function exportCitiesCSV() {
  if (!_lastCitiesData) { alert('Load city data first (go to Top Cities tab).'); return; }

  const headers = ['Rank', 'City', 'E-Waste (kt)', 'Population (M)', 'Device Rate (%)', 'Recycling Rate (%)', 'Risk Level', 'Intensity (%)'];
  const rows = _lastCitiesData.map((c, i) => [
    i + 1,
    c.name,
    c.waste_kt,
    c.population,
    (c.device_rate * 100).toFixed(0),
    c.recycling_rate ? (c.recycling_rate * 100).toFixed(0) : 'N/A',
    c.risk_level,
    (c.intensity * 100).toFixed(1)
  ]);

  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `ewaste_cities_india_${_lastCitiesYear}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportPrediction() {
  if (!_lastPrediction) return;
  const d = _lastPrediction;
  const content = [
    'E-WASTE INTELLIGENCE SYSTEM — AI PREDICTION REPORT',
    '='.repeat(52),
    `Generated: ${new Date().toLocaleString('en-IN')}`,
    '',
    'PREDICTION PARAMETERS',
    '-'.repeat(30),
    `Target Year:    ${d.year}`,
    `Population:     ${d.population} Million`,
    `Device Rate:    ${(d.device_rate * 100).toFixed(0)}%`,
    '',
    'RESULTS',
    '-'.repeat(30),
    `Predicted E-Waste:   ${d.predicted_waste_mmt} MMT`,
    `Lower Bound (95%):   ${d.confidence_lower} MMT`,
    `Upper Bound (95%):   ${d.confidence_upper} MMT`,
    `Unit:                Million Metric Tons`,
    '',
    'MODEL INFORMATION',
    '-'.repeat(30),
    'Algorithm:     Polynomial Regression (degree 2)',
    'Features:      Population, Device Usage Rate, Year',
    'Training Data: 2010–2023 (14 annual data points)',
    'Confidence:    ±5% prediction interval',
    '',
    'DATA SOURCES',
    '-'.repeat(30),
    '• Global E-Waste Monitor 2023 — UNU/ITU/UNITAR',
    '• E-Waste Management Rules 2022 — MoEFCC India',
    '• ASSOCHAM E-Waste Report 2023',
    '',
    'Generated by E-Waste Intelligence System | KIT Hackathon 2026',
  ].join('\n');

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `ewaste_prediction_${d.year}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportSolutionReport() {
  const riskGroups = Object.entries(RECOMMENDATIONS).map(([risk, rec]) => {
    const actions = rec.actions.map((a, i) => `  ${i+1}. ${a.text}`).join('\n');
    return `${risk.toUpperCase()} RISK CITIES\n${'-'.repeat(40)}\nRecommended Actions:\n${actions}\nExpected Impact: ${rec.impact}`;
  }).join('\n\n');

  const content = [
    'E-WASTE INTELLIGENCE SYSTEM — POLICY RECOMMENDATIONS REPORT',
    '='.repeat(60),
    `Generated: ${new Date().toLocaleString('en-IN')}`,
    `Scope: 15 major Indian cities | Reference Year: 2024`,
    '',
    'NATIONAL POLICY FRAMEWORK',
    '='.repeat(60),
    '2024–2025: Strengthen EPR Framework',
    '  → Increase EPR collection efficiency from 30% to 60% for all OEMs',
    '  → Estimated 12% waste reduction in formal streams',
    '',
    '2025–2027: Urban E-Waste Collection Network',
    '  → Deploy 500+ dedicated collection kiosks across top 15 cities',
    '  → Estimated 18% increase in formal recycling rate',
    '',
    '2027–2030: Circular Economy Transition',
    '  → Establish 10 e-waste processing parks with certified operators',
    '  → Target 40% national formal recycling rate',
    '  → Estimated 35% overall reduction vs baseline trajectory',
    '',
    'CITY-LEVEL RECOMMENDATIONS BY RISK CATEGORY',
    '='.repeat(60),
    riskGroups,
    '',
    'Generated by E-Waste Intelligence System | KIT Hackathon 2026',
  ].join('\n');

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `ewaste_policy_recommendations.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
