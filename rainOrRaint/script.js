// 🌤️ Replace this with your actual OpenWeatherMap key:
const openWeatherKey = "50162b2d1d243b9fd2fb5a1959ae8abb"; 
const resultBox = document.getElementById("result");

async function getWeather() {
  const city = document.getElementById("cityInput").value.trim();

  if (city === "") {
    resultBox.innerHTML = `<div class="error">⚠️ Please enter a city or country name.</div>`;
    return;
  }

  try {
    await getGlobalWeather(city);
  } catch (error) {
    console.error(error);
    resultBox.innerHTML = `<div class="error">❌ Failed to load weather data. Please check your connection.</div>`;
  }
}

async function getGlobalWeather(city) {
  // Current weather
  const currentUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${openWeatherKey}&units=metric&lang=en`;
  const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${openWeatherKey}&units=metric&lang=en`;

  const [currentResponse, forecastResponse] = await Promise.all([
    fetch(currentUrl),
    fetch(forecastUrl)
  ]);

  if (!currentResponse.ok) {
    resultBox.innerHTML = `<div class="error">❌ City or country "${city}" not found.</div>`;
    return;
  }

  const currentData = await currentResponse.json();
  const forecastData = await forecastResponse.json();

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  // Display current data
  resultBox.innerHTML = `
    <div class="valid">
      <h2>${currentData.name}, ${currentData.sys.country}</h2>
      <p><strong>📅 Date:</strong> ${today}</p>
      <img class="weather-icon" src="https://openweathermap.org/img/wn/${currentData.weather[0].icon}@2x.png" alt="">
      <p><strong>🌡️ Temp:</strong> ${currentData.main.temp.toFixed(1)}°C</p>
      <p><strong>☁️ Condition:</strong> ${currentData.weather[0].description}</p>
      <p><strong>💧 Humidity:</strong> ${currentData.main.humidity}%</p>
      <p><strong>🌬️ Wind:</strong> ${currentData.wind.speed} m/s</p>
      <canvas id="tempChart" width="300" height="200"></canvas>
    </div>
  `;

  // Prepare graph data
  const labels = [];
  const temps = [];

  // Extract temperature every 8 intervals (~1 per day)
  for (let i = 0; i < forecastData.list.length; i += 8) {
    const item = forecastData.list[i];
    const date = new Date(item.dt * 1000);
    labels.push(date.toLocaleDateString("en-GB", { weekday: "short" }));
    temps.push(item.main.temp);
  }

  // Draw graph
  const ctx = document.getElementById("tempChart").getContext("2d");
  new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [{
        label: "🌡️ Temperature (°C)",
        data: temps,
        borderColor: "rgba(0, 123, 255, 1)",
        backgroundColor: "rgba(0, 123, 255, 0.2)",
        borderWidth: 2,
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      scales: {
        y: { beginAtZero: false },
      }
    }
  });
}

// Auto-load default city
window.addEventListener("load", () => {
  document.getElementById("cityInput").value = "Langkawi";
  getWeather();
});
