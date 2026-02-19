'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Cloud, Sun, CloudRain, Snowflake, CloudLightning, CloudDrizzle, CloudFog } from 'lucide-react';

interface WeatherData {
  temp: number;
  unit: string;
  condition: string;
  weatherCode: number;
}

function getWeatherIcon(code: number) {
  if (code === 0) return <Sun className="w-8 h-8 text-mc-accent-yellow" />;
  if (code <= 3) return <Cloud className="w-8 h-8 text-mc-text-secondary" />;
  if (code <= 48) return <CloudFog className="w-8 h-8 text-mc-text-secondary" />;
  if (code <= 57) return <CloudDrizzle className="w-8 h-8 text-mc-accent-cyan" />;
  if (code <= 67) return <CloudRain className="w-8 h-8 text-mc-accent-cyan" />;
  if (code <= 77) return <Snowflake className="w-8 h-8 text-white" />;
  if (code <= 86) return <Snowflake className="w-8 h-8 text-white" />;
  if (code <= 99) return <CloudLightning className="w-8 h-8 text-mc-accent-yellow" />;
  return <Cloud className="w-8 h-8 text-mc-text-secondary" />;
}

export function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const fetchWeather = async (lat?: number, lon?: number) => {
      const params = lat && lon ? `?lat=${lat}&lon=${lon}` : '';
      try {
        const res = await fetch(`/api/dashboard/weather${params}`);
        if (res.ok) setWeather(await res.json());
      } catch {}
    };

    // Try geolocation if available and permitted, otherwise use defaults
    try {
      if (navigator.geolocation && navigator.permissions) {
        navigator.permissions.query({ name: 'geolocation' }).then(result => {
          if (result.state === 'granted' || result.state === 'prompt') {
            navigator.geolocation.getCurrentPosition(
              pos => fetchWeather(pos.coords.latitude, pos.coords.longitude),
              () => fetchWeather()
            );
          } else {
            fetchWeather();
          }
        }).catch(() => fetchWeather());
      } else {
        fetchWeather();
      }
    } catch {
      fetchWeather();
    }

    const weatherInterval = setInterval(() => fetchWeather(), 30 * 60 * 1000);
    const clockInterval = setInterval(() => setCurrentTime(new Date()), 60000);

    return () => { clearInterval(weatherInterval); clearInterval(clockInterval); };
  }, []);

  return (
    <div className="flex flex-col items-center gap-2">
      {weather ? (
        <>
          {getWeatherIcon(weather.weatherCode)}
          <div className="text-2xl font-bold">{weather.temp}{weather.unit}</div>
          <div className="text-xs text-mc-text-secondary">{weather.condition}</div>
        </>
      ) : (
        <>
          <div className="w-8 h-8 bg-mc-bg-tertiary rounded-full animate-pulse" />
          <div className="h-6 w-16 bg-mc-bg-tertiary rounded animate-pulse" />
          <div className="h-3 w-10 bg-mc-bg-tertiary rounded animate-pulse" />
        </>
      )}
      <div className="mt-2 text-center">
        <div className="text-lg font-mono font-bold">{format(currentTime, 'HH:mm')}</div>
        <div className="text-xs text-mc-text-secondary">{format(currentTime, 'EEEE, MMM d')}</div>
      </div>
    </div>
  );
}
