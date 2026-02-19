import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory cache
let weatherCache: { data: unknown; expiresAt: number } | null = null;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat') || '25.2048'; // Default: Dubai
  const lon = searchParams.get('lon') || '55.2708';

  // Return cached if valid
  if (weatherCache && Date.now() < weatherCache.expiresAt) {
    return NextResponse.json(weatherCache.data);
  }

  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`,
      { next: { revalidate: 1800 } } // 30 min
    );

    if (!res.ok) {
      return NextResponse.json({ error: 'Weather fetch failed' }, { status: 502 });
    }

    const raw = await res.json();
    const current = raw.current;

    const data = {
      temp: Math.round(current.temperature_2m),
      unit: raw.current_units?.temperature_2m || '°C',
      weatherCode: current.weather_code,
      condition: weatherCodeToCondition(current.weather_code),
      timezone: raw.timezone,
    };

    weatherCache = { data, expiresAt: Date.now() + 30 * 60 * 1000 };
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
