'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Cloud, Sun, CloudRain, Snowflake, CloudLightning, CloudDrizzle, CloudFog } from 'lucide-react';

interface WeatherData {
  temp: number;
  unit: string;
  condition: string;
  weatherCode: number;
  location?: string;
}

function getWeatherIcon(code: number) {
  const cls = 'w-5 h-5 text-white/40';
  if (code === 0) return <Sun className={cls} />;
  if (code <= 3) return <Cloud className={cls} />;
  if (code <= 48) return <CloudFog className={cls} />;
  if (code <= 57) return <CloudDrizzle className={cls} />;
  if (code <= 67) return <CloudRain className={cls} />;
  if (code <= 77) return <Snowflake className={cls} />;
  if (code <= 86) return <Snowflake className={cls} />;
  if (code <= 99) return <CloudLightning className={cls} />;
  return <Cloud className={cls} />;
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

  if (!weather) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-2">
        <div className="h-8 w-20 bg-white/[0.04] rounded-lg animate-pulse" />
        <div className="h-4 w-14 bg-white/[0.04] rounded animate-pulse" />
        <div className="h-6 w-16 bg-white/[0.04] rounded animate-pulse mt-2" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1 py-2">
      {weather.location && (
        <span className="text-[11px] text-white/30 uppercase tracking-widest mb-1">{weather.location}</span>
      )}
      <div className="flex items-center gap-2">
        {getWeatherIcon(weather.weatherCode)}
        <span className="text-3xl font-light tracking-tight">{weather.temp}{weather.unit}</span>
      </div>
      <span className="text-[11px] text-white/40">{weather.condition}</span>
      <div className="mt-3 text-center">
        <div className="text-xl font-light tracking-tight">{format(currentTime, 'HH:mm')}</div>
        <div className="text-[11px] text-white/30 uppercase tracking-widest mt-1">{format(currentTime, 'EEEE, MMM d')}</div>
      </div>
    </div>
  );
}
