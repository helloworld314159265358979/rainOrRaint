const apiKey = "50162b2d1d243b9fd2fb5a1959ae8abb";

const cityInput = document.getElementById("cityInput");
const dateInput = document.getElementById("dateInput");
const resultDiv = document.getElementById("result");
const checkWeatherBtn = document.getElementById("checkWeatherBtn");

// Button click and Enter
checkWeatherBtn.addEventListener("click", fetchWeather);
document.addEventListener("keydown", e => { if(e.key === "Enter") fetchWeather(); });

async function fetchWeather() {
  const city = cityInput.value.trim();
  const date = dateInput.value.trim();

  if (!city) {
    resultDiv.innerHTML = `<p class="error">❌ Please enter a city name.</p>`;
    return;
  }

  resultDiv.innerHTML = `<p>🔍 Fetching weather data...</p>`;

  try {
    let forecastData = [];
    let cityName = city;
    let country = "";

    if (!date) {
      // Forecast from OpenWeatherMap
      const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Invalid city name or API error.");
      const data = await response.json();
      cityName = data.city.name;
      country = data.city.country;

      const lat = data.city.coord.lat;
      const lon = data.city.coord.lon;
      const aqiData = await fetch(`http://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`)
                          .then(res => res.json());

      forecastData = buildForecast(data.list, aqiData);

    } else {
      // Simulated past weather
      forecastData.push(simulateDay(date));
    }

    displayCalendar(forecastData, cityName, country);

  } catch (err) {
    resultDiv.innerHTML = `<p class="error">⚠️ ${err.message}</p>`;
    document.body.style.background = "#eef2f3"; // fallback background
  }
}

// Build 30-day forecast
function buildForecast(apiList, aqiData) {
  const daysSet = new Set();
  let forecasts = [];

  apiList.forEach(item => {
    const date = item.dt_txt.split(" ")[0];
    if (!daysSet.has(date)) {
      daysSet.add(date);
      forecasts.push({
        date,
        temp: item.main.temp,
        humidity: item.main.humidity,
        rain: item.pop ? (item.pop * 100).toFixed(0) : Math.floor(Math.random() * 100),
        wind: item.wind.speed,
        weather: item.weather[0].main,
        aqi: aqiData.list[0].main.aqi
      });
    }
  });

  const today = new Date();
  while (forecasts.length < 30) {
    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + forecasts.length);
    forecasts.push(simulateDay(nextDate.toISOString().split("T")[0]));
  }

  return forecasts;
}

// Simulate day for future/past
function simulateDay(date) {
  const temp = (15 + Math.random() * 15).toFixed(1);
  const humidity = (40 + Math.random() * 40).toFixed(0);
  const rain = Math.floor(Math.random() * 100);
  const wind = (5 + Math.random() * 10).toFixed(1);
  const weather = ["Clear","Clouds","Rain","Thunderstorm"][Math.floor(Math.random()*4)];
  const aqi = Math.floor(Math.random() * 5) + 1;
  return { date: date.replace(/-/g, "/"), temp, humidity, rain, wind, weather, aqi };
}

// AQI description
function getAQISuggestion(aqi) {
  switch(aqi) {
    case 1: return "Good";
    case 2: return "Fair";
    case 3: return "Moderate";
    case 4: return "Poor";
    case 5: return "Very Poor";
    default: return "Unknown";
  }
}

// Activity suggestion
function getActivitySuggestion(day) {
  const temp = parseFloat(day.temp), rain = parseFloat(day.rain), wind = parseFloat(day.wind||0);
  const weather = day.weather, humidity = parseFloat(day.humidity||50), aqi = parseInt(day.aqi||1);

  if(aqi===5) return "Best for indoor activities (very poor AQI)";
  if(aqi===4) return "Not suitable for outdoor activities (poor AQI)";
  if(aqi===3) return "Short outdoor activities only (moderate AQI)";
  if(aqi===2) return "Slight caution for outdoor activity (fair AQI)";
  if(temp<10 || temp>40 || humidity>85) return "Indoor activities recommended";
  if(weather==="Rain" || weather==="Thunderstorm" || rain>50) return "Avoid outdoor activities";
  if(weather==="Clear" && temp>=20 && temp<=30 && rain<20 && wind<10 && humidity<70) return "Perfect for outdoor activities";
  if(weather==="Clear" && temp>30 && temp<=35 && rain<15) return "Good for long-term outdoor activities";
  if(weather==="Clear" && (temp<20||temp>35)) return "Short outdoor activities recommended";
  if(weather==="Clouds" && temp>=15 && temp<=35 && (rain>=20 || wind>15)) return "Not recommended for outdoor activities";
  if(temp>=18 && temp<=25 && rain<20 && wind<15) return "Good for exercise/sports";
  if(weather==="Clear" && (temp>32 || wind>20)) return "Caution for prolonged outdoor exposure";
  if(temp>=15 && temp<=28 && weather!=="Rain") return "Pleasant for walking/hiking";
  return "Outdoor activities not recommended";
}

// Update website background according to today's weather
function updateBackground(weather) {
  switch(weather) {
    case "Clear":
      document.body.style.background = "linear-gradient(to right, #fceabb, #f8b500)";
      break;
    case "Clouds":
      document.body.style.background = "linear-gradient(to right, #b0bec5, #78909c)";
      break;
    case "Rain":
      document.body.style.background = "linear-gradient(to right, #81d4fa, #4fc3f7)";
      break;
    case "Thunderstorm":
      document.body.style.background = "linear-gradient(to right, #9575cd, #7e57c2)";
      break;
    default:
      document.body.style.background = "#eef2f3";
  }
}

// Display calendar with tooltip
function displayCalendar(forecasts, cityName, country) {
  const hottest = forecasts.reduce((a,b)=>parseFloat(a.temp)>parseFloat(b.temp)?a:b);
  const coldest = forecasts.reduce((a,b)=>parseFloat(a.temp)<parseFloat(b.temp)?a:b);

  // Update background according to today's weather
  updateBackground(forecasts[0].weather);

  let calendarHTML = `<div class="calendar"><h3>📆 30-Day Weather for ${cityName}, ${country}</h3>`;

  forecasts.forEach(day => {
    let extraClass = "";
    if(day.date === hottest.date) extraClass = "hot";
    if(day.date === coldest.date) extraClass = "cold";

    let icon = "";
    switch(day.weather){
      case "Clear": icon="☀️"; break;
      case "Clouds": icon="☁️"; break;
      case "Rain": icon="🌧️"; break;
      case "Thunderstorm": icon="🌩️"; break;
      default: icon="❓"; break;
    }

    let bgColor = "#ffffff22";
    switch(day.weather){
      case "Clear": bgColor="#fbe9e7"; break;
      case "Clouds": bgColor="#b0bec5"; break;
      case "Rain": bgColor="#81d4fa"; break;
      case "Thunderstorm": bgColor="#9575cd"; break;
      default: bgColor="#ffffff22"; break;
    }

    calendarHTML += `
      <div class="day ${extraClass}" style="background:${bgColor}">
        <strong>${day.date}</strong><br>
        <div>${icon}</div>
        <div class="tooltip">
          🌡️ Temp: ${day.temp}°C<br>
          💧 Humidity: ${day.humidity}%<br>
          🌧️ Rain: ${day.rain}%<br>
          🌬️ Wind: ${day.wind} km/h<br>
          🌡️ Weather: ${day.weather}<br>
          🏞️ Activity: ${getActivitySuggestion(day)}<br>
          🌫️ Air Quality: ${getAQISuggestion(day.aqi)} (AQI ${day.aqi})
        </div>
      </div>
    `;
  });

  calendarHTML += `</div>`;
  resultDiv.innerHTML = calendarHTML;

  // Tooltip appears next to day box
  const dayElems = document.querySelectorAll(".day");
  dayElems.forEach(day => {
    const tooltip = day.querySelector(".tooltip");
    tooltip.style.display = "none";

    day.addEventListener("mouseenter", () => { tooltip.style.display = "block"; });
    day.addEventListener("mouseleave", () => { tooltip.style.display = "none"; });
  });
}
