#!/usr/bin/env node

const https = require('https');

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function geocode(location) {
  if (/^-?\d+\.?\d*,-?\d+\.?\d*$/.test(location)) {
    const [lat, lon] = location.split(',');
    return { lat: parseFloat(lat), lon: parseFloat(lon), name: location };
  }
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=es&format=json`;
  const res = await fetchJSON(url);
  if (!res.results || res.results.length === 0) throw new Error(`Ubicación no encontrada: ${location}`);
  const r = res.results[0];
  return { lat: r.latitude, lon: r.longitude, name: `${r.name}${r.admin1 ? ', ' + r.admin1 : ''}${r.country ? ', ' + r.country : ''}` };
}

function getWeatherDesc(code) {
  const map = {
    0: 'Despejado', 1: 'Poco nublado', 2: 'Parcialmente nublado', 3: 'Nublado',
    45: 'Niebla', 48: 'Niebla con escarcha',
    51: 'Llovizna leve', 53: 'Llovizna moderada', 55: 'Llovizna densa',
    61: 'Lluvia débil', 63: 'Lluvia moderada', 65: 'Lluvia fuerte',
    71: 'Nieve débil', 73: 'Nieve moderada', 75: 'Nieve fuerte',
    77: 'Granizo', 80: 'Chubascos débiles', 81: 'Chubascos moderados', 82: 'Chubascos fuertes',
    85: 'Aguanieve leve', 86: 'Aguanieve fuerte',
    95: 'Tormenta', 96: 'Tormenta con granizo', 99: 'Tormenta fuerte con granizo'
  };
  return map[code] || `Código ${code}`;
}

async function getWeather(location = 'Madrid', options = {}) {
  const geo = await geocode(location);
  const params = new URLSearchParams({
    latitude: geo.lat,
    longitude: geo.lon,
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,pressure_msl,uv_index',
    temperature_unit: 'celsius',
    wind_speed_unit: 'kmh',
    timezone: 'auto'
  });

  if (options.forecast) params.append('daily', 'temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum');
  if (options.hourly) params.append('hourly', 'temperature_2m,weather_code');

  const url = `https://api.open-meteo.com/v1/forecast?${params}`;
  const data = await fetchJSON(url);
  const curr = data.current;

  let output = `📍 ${geo.name}\n\n🌡️ Actual: ${curr.temperature_2m}°C (sensación: ${curr.apparent_temperature}°C)\n`;
  output += `☁️ ${getWeatherDesc(curr.weather_code)}\n`;
  if (options.details) {
    output += `💧 Humedad: ${curr.relative_humidity_2m}%\n`;
    output += `💨 Viento: ${curr.wind_speed_10m} km/h\n`;
    output += `🔽 Presión: ${curr.pressure_msl} hPa\n`;
    output += `☀️ UV: ${curr.uv_index}\n`;
  }

  if (options.forecast && data.daily) {
    output += `\n📅 Pronóstico 7 días:\n`;
    const daily = data.daily;
    for (let i = 0; i < Math.min(7, daily.time.length); i++) {
      output += `${daily.time[i]}: ${daily.temperature_2m_min[i]}° a ${daily.temperature_2m_max[i]}°C - ${getWeatherDesc(daily.weather_code[i])}${daily.precipitation_sum[i] > 0 ? ` (lluvia: ${daily.precipitation_sum[i]}mm)` : ''}\n`;
    }
  }

  if (options.hourly && data.hourly) {
    output += `\n⏰ Próximas 24 horas:\n`;
    const hourly = data.hourly;
    for (let i = 0; i < Math.min(24, hourly.time.length); i += 3) {
      const hour = new Date(hourly.time[i]).getHours();
      output += `${hour.toString().padStart(2, '0')}:00 - ${hourly.temperature_2m[i]}°C - ${getWeatherDesc(hourly.weather_code[i])}\n`;
    }
  }

  return output;
}

const args = process.argv.slice(2);
let location = 'Madrid';
const options = { forecast: false, hourly: false, details: false };

for (const arg of args) {
  if (arg === '--forecast') options.forecast = true;
  else if (arg === '--hourly') options.hourly = true;
  else if (arg === '--details') options.details = true;
  else location = arg;
}

getWeather(location, options).then(console.log).catch(err => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
