/* Robust input handling, separate Start / End groups, Malaysia bounds,
   auto-climatology, spinner/timer, Chart output, clear error/warnings. */

const MIN_YEAR = 1981;
const MAX_AVAILABLE_DATE = '20250630'; // dataset last daily date known
const CURRENT_YEAR = new Date().getFullYear();

// Elements
const startYear = document.getElementById('startYear');
const startMonth = document.getElementById('startMonth');
const startDay = document.getElementById('startDay');
const endYear = document.getElementById('endYear');
const endMonth = document.getElementById('endMonth');
const endDay = document.getElementById('endDay');

const startWarning = document.getElementById('startWarning');
const endWarning = document.getElementById('endWarning');

const latSlider = document.getElementById('latSlider');
const latBox = document.getElementById('latBox');
const lonSlider = document.getElementById('lonSlider');
const lonBox = document.getElementById('lonBox');

const getBtn = document.getElementById('getForecast');
const spinner = document.getElementById('spinner');
const timerEl = document.getElementById('timer');
const cautionEl = document.getElementById('caution');
const errorMessage = document.getElementById('errorMessage');

const tableHeaderRow = document.getElementById('tableHeaderRow');
const tableBody = document.querySelector('#rainfallTable tbody');
const chartCanvas = document.getElementById('rainChart');

let chartInstance = null;
let timerInterval = null;
let timerStart = 0;

// ---------- Utilities ----------
function pad(n, digits=2){ return String(n).padStart(digits,'0'); }
function clampInt(n, min, max){ n = Number(n); if (!isFinite(n)) return min; n = Math.trunc(n); return Math.max(min, Math.min(max, n)); }
function clampFloat(n, min, max, decimals=3){ let x = Number(n); if (!isFinite(x)) x = min; if (x < min) x = min; if (x > max) x = max; return Number(x.toFixed(decimals)); }
function daysInMonth(year, month){ return new Date(year, month, 0).getDate(); }

// ---------- Date input behaviors (separate start and end handling) ----------

// YEAR behavior: while typing - negative -> 0, > CURRENT_YEAR -> clamp to CURRENT_YEAR;
// on blur -> clamp to [MIN_YEAR .. CURRENT_YEAR]
function bindYearField(yearEl, warningEl) {
  yearEl.addEventListener('input', () => {
    // accept digits only while typing
    yearEl.value = String(yearEl.value).replace(/[^\d]/g, '');
    if (yearEl.value === '') return;
    let v = Number(yearEl.value);
    if (!isFinite(v)) { yearEl.value = ''; return; }
    if (v < 0) yearEl.value = '0';
    if (v > CURRENT_YEAR) yearEl.value = String(CURRENT_YEAR);
    // don't snap to MIN_YEAR while typing
    if (Number(yearEl.value) < MIN_YEAR) {
      warningEl.textContent = `typing: years below ${MIN_YEAR} allowed while typing but will snap on blur`;
    } else {
      warningEl.textContent = '';
    }
  });

  yearEl.addEventListener('blur', () => {
    if (yearEl.value === '') { yearEl.value = String(CURRENT_YEAR); }
    let v = clampInt(yearEl.value, MIN_YEAR, CURRENT_YEAR);
    yearEl.value = String(v);
    warningEl.textContent = '';
    // update dependent day inputs if necessary
    updateDayLimitForPairIfNeeded(yearEl);
  });

  // initialize default if empty
  if (!yearEl.value) yearEl.value = String(CURRENT_YEAR);
}

// MONTH behavior: allow scroll; on blur clamp to 1..12 and adjust day max
function bindMonthField(monthEl) {
  monthEl.addEventListener('input', () => {
    // keep numeric-like
    monthEl.value = String(monthEl.value).replace(/[^\d]/g, '');
  });
  monthEl.addEventListener('blur', () => {
    if (monthEl.value === '') monthEl.value = '1';
    monthEl.value = String(clampInt(monthEl.value, 1, 12));
    // update dependent day field(s)
    updateDayLimitForPairIfNeeded(monthEl);
  });
  if (!monthEl.value) monthEl.value = String((new Date()).getMonth()+1);
}

// DAY behavior: clamp on blur based on year+month
function bindDayField(dayEl) {
  dayEl.addEventListener('input', () => {
    dayEl.value = String(dayEl.value).replace(/[^\d]/g, '');
  });
  dayEl.addEventListener('blur', () => {
    // dayEl.dataset should contain attr 'pair' to find related year/month
    const pair = dayEl.dataset.pair; // "start" or "end"
    const yEl = (pair === 'start') ? startYear : endYear;
    const mEl = (pair === 'start') ? startMonth : endMonth;
    const y = clampInt(yEl.value || CURRENT_YEAR, MIN_YEAR, CURRENT_YEAR);
    const m = clampInt(mEl.value || 1, 1, 12);
    const maxD = daysInMonth(y, m);
    if (dayEl.value === '') dayEl.value = '1';
    dayEl.value = String(clampInt(dayEl.value, 1, maxD));
  });
  if (!dayEl.value) dayEl.value = String((new Date()).getDate());
}

// helper to update day limit when year or month changed for start or end
function updateDayLimitForPairIfNeeded(changedEl) {
  // determine which group changed
  // if changedEl is startYear or startMonth, update startDay
  if (changedEl === startYear || changedEl === startMonth) {
    const y = clampInt(startYear.value || CURRENT_YEAR, MIN_YEAR, CURRENT_YEAR);
    const m = clampInt(startMonth.value || 1, 1, 12);
    const maxD = daysInMonth(y,m);
    if (Number(startDay.value) > maxD) startDay.value = String(maxD);
  }
  if (changedEl === endYear || changedEl === endMonth) {
    const y = clampInt(endYear.value || CURRENT_YEAR, MIN_YEAR, CURRENT_YEAR);
    const m = clampInt(endMonth.value || 1, 1, 12);
    const maxD = daysInMonth(y,m);
    if (Number(endDay.value) > maxD) endDay.value = String(maxD);
  }
}

// Bind fields explicitly and set pair attribute on days
bindYearField(startYear, startWarning);
bindMonthField(startMonth);
bindDayField(startDay);
startDay.dataset.pair = 'start';

bindYearField(endYear, endWarning);
bindMonthField(endMonth);
bindDayField(endDay);
endDay.dataset.pair = 'end';

// initialize day limits on load
updateDayLimitForPairIfNeeded(startYear);
updateDayLimitForPairIfNeeded(startMonth);
updateDayLimitForPairIfNeeded(endYear);
updateDayLimitForPairIfNeeded(endMonth);

// ---------- Lat/Lon (Malaysia bounds) ----------
const LAT_MIN = 1.0, LAT_MAX = 7.5;
const LON_MIN = 100.0, LON_MAX = 120.0;

function bindLatLon(sliderEl, boxEl, min, max) {
  // initialize step / bounds
  sliderEl.min = min; sliderEl.max = max;
  if (!boxEl.value) boxEl.value = sliderEl.value || min;
  sliderEl.addEventListener('input', () => {
    const v = clampFloat(sliderEl.value, min, max, 3);
    boxEl.value = v;
  });
  boxEl.addEventListener('input', () => {
    // sanitize
    boxEl.value = String(boxEl.value).replace(/[^\d.\-]/g,'');
    const v = clampFloat(boxEl.value || min, min, max, 3);
    boxEl.value = v;
    sliderEl.value = v;
  });
}

bindLatLon(latSlider, latBox, LAT_MIN, LAT_MAX);
bindLatLon(lonSlider, lonBox, LON_MIN, LON_MAX);
// set sensible defaults if empty
if (!latBox.value) { latBox.value = '3.139'; latSlider.value = latBox.value; }
if (!lonBox.value) { lonBox.value = '101.6869'; lonSlider.value = lonBox.value; }

// ---------- Timer & spinner ----------
function startTimer() {
  spinner.style.display = 'inline-block';
  timerStart = performance.now();
  timerEl.textContent = '00:00:000';
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const elapsed = performance.now() - timerStart;
    const minutes = Math.floor(elapsed/60000);
    const seconds = Math.floor((elapsed%60000)/1000);
    const ms = Math.floor(elapsed%1000);
    timerEl.textContent = `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}.${String(ms).padStart(3,'0')}`;
  }, 40);
}
function stopTimer() {
  clearInterval(timerInterval);
  spinner.style.display = 'none';
}

// ---------- Rain level helper ----------
function getRainLevel(mm) {
  if (mm === -999 || mm === null || mm === undefined) return {text:'Data Unavailable', cls:'rain-none'};
  if (mm < 2) return {text:'No rain', cls:'rain-none'};
  if (mm < 10) return {text:'Light rain', cls:'rain-light'};
  if (mm < 20) return {text:'Moderate rain', cls:'rain-moderate'};
  if (mm < 50) return {text:'Heavy rain', cls:'rain-heavy'};
  return {text:'Very heavy', cls:'rain-heavy'};
}

// ---------- Chart ----------
function drawChart(labels, values, isMonthly=false) {
  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
  const ctx = chartCanvas.getContext('2d');
  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Precipitation (mm)',
        data: values,
        backgroundColor: values.map(v => {
          if (v === -999) return '#9e9e9e';
          if (v < 2) return '#b0bec5';
          if (v < 10) return '#4fc3f7';
          if (v < 20) return '#29b6f6';
          if (v < 50) return '#1e88e5';
          return '#0d47a1';
        })
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { title: { display: true, text: isMonthly ? 'Month' : 'Date' } },
        y: { title: { display: true, text: 'Rainfall (mm)' } }
      }
    }
  });
}

// ---------- Main fetch logic ----------
async function fetchData() {
  // Clear UI
  tableBody.innerHTML = '';
  errorMessage.textContent = '';
  cautionEl.textContent = '';

  // sanitize final dates (in case user didn't blur)
  // Start
  startYear.value = startYear.value === '' ? String(CURRENT_YEAR) : startYear.value;
  startMonth.value = startMonth.value === '' ? '1' : startMonth.value;
  startDay.value = startDay.value === '' ? '1' : startDay.value;
  // End
  endYear.value = endYear.value === '' ? String(CURRENT_YEAR) : endYear.value;
  endMonth.value = endMonth.value === '' ? '1' : endMonth.value;
  endDay.value = endDay.value === '' ? '1' : endDay.value;

  // final clamped ints
  const sy = clampInt(startYear.value, 0, CURRENT_YEAR); // 0 allowed mid-typing fallback; should be >= MIN_YEAR for valid
  const sm = clampInt(startMonth.value, 1, 12);
  const sd = clampInt(startDay.value, 1, daysInMonth(Math.max(sy,MIN_YEAR), sm));

  const ey = clampInt(endYear.value, 0, CURRENT_YEAR);
  const em = clampInt(endMonth.value, 1, 12);
  const ed = clampInt(endDay.value, 1, daysInMonth(Math.max(ey,MIN_YEAR), em));

  // push sanitized back
  startYear.value = String(sy); startMonth.value = String(sm); startDay.value = String(sd);
  endYear.value = String(ey); endMonth.value = String(em); endDay.value = String(ed);

  // Check date order
  const startStr = `${String(sy).padStart(4,'0')}${String(sm).padStart(2,'0')}${String(sd).padStart(2,'0')}`;
  const endStr = `${String(ey).padStart(4,'0')}${String(em).padStart(2,'0')}${String(ed).padStart(2,'0')}`;
  if (Number(startStr) > Number(endStr)) {
    errorMessage.textContent = 'Start date cannot be after End date.';
    return;
  }

  // lat/lon clamp
  const lat = clampFloat(latBox.value || latSlider.value || 3.139, LAT_MIN, LAT_MAX, 3);
  const lon = clampFloat(lonBox.value || lonSlider.value || 101.6869, LON_MIN, LON_MAX, 3);
  latBox.value = lat; lonBox.value = lon; latSlider.value = lat; lonSlider.value = lon;

  // Decide climatology: if start < 19810101 OR end > MAX_AVAILABLE_DATE OR any year < MIN_YEAR
  const startNum = Number(startStr);
  const endNum = Number(endStr);
  const minSupportedNum = Number(`${MIN_YEAR}0101`);
  const needClimatology = (startNum < minSupportedNum) || (endNum > Number(MAX_AVAILABLE_DATE)) || (sy < MIN_YEAR) || (ey < MIN_YEAR);

  if (needClimatology) {
    cautionEl.textContent = `⚠ Dates outside ${MIN_YEAR}-06-30/2025 require climatology; app will auto-use climatology.`;
  } else {
    cautionEl.textContent = '';
  }

  // Build URL
  let url = '';
  if (needClimatology) {
    url = `https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=PRECTOTCORR&community=RE&longitude=${lon}&latitude=${lat}&format=JSON`;
  } else {
    url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=PRECTOTCORR&community=RE&longitude=${lon}&latitude=${lat}&start=${startStr}&end=${endStr}&format=JSON`;
  }

  // Start spinner/timer
  startTimer();

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // data validation
    if (!data || !data.properties || !data.properties.parameter || !data.properties.parameter.PRECTOTCORR) {
      throw new Error('API returned unexpected structure.');
    }

    const vals = data.properties.parameter.PRECTOTCORR;
    const labels = [];
    const values = [];

    if (needClimatology) {
      // climatology: keys 1..12 (or '01'..'12')
      tableHeaderRow.innerHTML = `<th>Month</th><th>Precipitation (mm)</th><th>Level</th>`;
      const months = Object.keys(vals).map(k => String(k)).sort((a,b)=>Number(a)-Number(b));
      for (const key of months) {
        const raw = vals[key];
        const val = (raw === undefined || raw === null) ? -999 : Number(raw);
        const level = getRainLevel(val === -999 ? -999 : val);
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${String(Number(key)).padStart(2,'0')}</td>
                        <td>${val===-999 ? 'Data Unavailable' : val.toFixed(2)}</td>
                        <td><span class="badge ${level.cls}">${level.text}</span></td>`;
        tableBody.appendChild(tr);
        if (val !== -999) { labels.push(`M${String(Number(key)).padStart(2,'0')}`); values.push(val); }
      }
    } else {
      // daily mode
      tableHeaderRow.innerHTML = `<th>Year</th><th>Month</th><th>Day</th><th>Precipitation (mm)</th><th>Level</th>`;
      const dates = Object.keys(vals).sort();
      for (const d of dates) {
        const raw = vals[d];
        const val = (raw === undefined || raw === null) ? -999 : Number(raw);
        const yyyy = d.slice(0,4), mm = d.slice(4,6), dd = d.slice(6,8);
        const level = getRainLevel(val===-999 ? -999 : val);
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${yyyy}</td><td>${mm}</td><td>${dd}</td>
                        <td>${val===-999 ? 'Data Unavailable' : val.toFixed(2)}</td>
                        <td><span class="badge ${level.cls}">${level.text}</span></td>`;
        tableBody.appendChild(tr);
        if (val !== -999) { labels.push(`${yyyy}-${mm}-${dd}`); values.push(val); }
      }
    }

    // draw chart if any data
    if (labels.length > 0) drawChart(labels, values, needClimatology);

  } catch (err) {
    console.error('Fetch error:', err);
    errorMessage.textContent = '❌ Failed to load data: ' + (err.message || 'Unknown error');
  } finally {
    stopTimer();
  }
}

// attach
getBtn.addEventListener('click', fetchData);

// initialize defaults
(function initDefaults(){
  // start/end today's date
  const t = new Date();
  const yyyy = t.getFullYear(), mm = t.getMonth()+1, dd = t.getDate();
  startYear.value = endYear.value = String(yyyy);
  startMonth.value = endMonth.value = String(mm);
  startDay.value = endDay.value = String(dd);

  // lat/lon defaults set earlier above
  latBox.value = latBox.value || '3.139'; latSlider.value = latBox.value;
  lonBox.value = lonBox.value || '101.6869'; lonSlider.value = lonBox.value;

  // dispatch blur to initialize warning text and day limits
  [startYear,startMonth,startDay,endYear,endMonth,endDay].forEach(el => el.dispatchEvent(new Event('blur')));
})();
