import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory cache
let weatherCache: { data: unknown; expiresAt: number; key: string } | null = null;

async function reverseGeocode(lat: string, lon: string): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10&accept-language=en`,
      { headers: { 'User-Agent': 'MissionControl/1.0' } }
    );
    if (!res.ok) return '';
    const data = await res.json();
    return data.address?.city || data.address?.town || data.address?.county || '';
  } catch {
    return '';
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat') || '41.4090'; // Default: Scranton, PA
  const lon = searchParams.get('lon') || '-75.6624';
  const cacheKey = `${lat},${lon}`;

  // Return cached if valid and same location
  if (weatherCache && Date.now() < weatherCache.expiresAt && weatherCache.key === cacheKey) {
    return NextResponse.json(weatherCache.data);
  }

  try {
    const [weatherRes, location] = await Promise.all([
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=auto`,
        { next: { revalidate: 1800 } }
      ),
      reverseGeocode(lat, lon),
    ]);

    if (!weatherRes.ok) {
      return NextResponse.json({ error: 'Weather fetch failed' }, { status: 502 });
    }

    const raw = await weatherRes.json();
    const current = raw.current;

    const data = {
      temp: Math.round(current.temperature_2m),
      unit: '°F',
      weatherCode: current.weather_code,
      condition: weatherCodeToCondition(current.weather_code),
      location,
      timezone: raw.timezone,
    };

    weatherCache = { data, expiresAt: Date.now() + 30 * 60 * 1000, key: cacheKey };
    return NextResponse.json(data);
  } catch (error) {
    console.error('Weather API error:', error);
    return NextResponse.json({ error: 'Weather service unavailable' }, { status: 502 });
  }
}

function weatherCodeToCondition(code: number): string {
  if (code === 0) return 'Clear';
  if (code <= 3) return 'Cloudy';
  if (code <= 48) return 'Foggy';
  if (code <= 57) return 'Drizzle';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Showers';
  if (code <= 86) return 'Snow Showers';
  if (code <= 99) return 'Thunderstorm';
  return 'Unknown';
}
