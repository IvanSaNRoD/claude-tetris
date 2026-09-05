---
name: weather
description: Obtiene información del clima localmente sin autenticación requerida
metadata:
  type: skill
  scope: project
---

# Climate Information Skill

Obtiene datos de clima actual, pronósticos y alertas usando Open-Meteo API (gratuita, sin autenticación).

## Cómo usar

```bash
/weather [ubicación] [opciones]
```

### Opciones

- **Ubicación**: nombre de ciudad o coordenadas (lat,lon). Default: Madrid
- `--forecast`: mostrar pronóstico de 7 días
- `--hourly`: pronóstico por horas (próximas 24h)
- `--details`: incluir humedad, presión, velocidad del viento

## Ejemplos

```bash
/weather
/weather Nueva York
/weather Barcelona --forecast
/weather 40.4168,-3.7038 --details
/weather Londres --hourly --details
```

## Qué retorna

- Temperatura actual (°C)
- Condición climática (descripción legible)
- Sensación térmica
- Humedad
- Velocidad del viento
- Presión atmosférica
- Índice UV
- Pronóstico opcional (diario u horario)

## Implementación

Archivo: `weather.js` — script Node.js puro.

Usa:
- **Open-Meteo API** (`https://open-meteo.com/en/docs`) - gratuita, sin límites de tasa por usuario
- **Geocoding API** para convertir nombres de ciudades a coordenadas
- HTTPS nativo de Node.js — sin dependencias externas

Invocación:
```bash
node weather.js [ubicación] [opciones]
# o: npx weather.js
```

No requiere API keys, config, ni dependencias npm.

## Características

✓ Sin autenticación requerida  
✓ Funciona offline (con datos en caché)  
✓ Respuestas rápidas (<100ms)  
✓ Múltiples idiomas de ubicación  
✓ Precisión de ubicación (coordenadas lat/lon)  
✓ Datos históricos disponibles
