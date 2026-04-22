/**
 * Weather code mappings for atmospheric data display
 */
export const WEATHER_CODE_MAP = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    71: 'Slight snow',
    73: 'Moderate snow',
    75: 'Heavy snow',
    95: 'Thunderstorm'
};

export const WEATHER_EMOJI_MAP = {
    clear: '☀️',
    partlyCloudy: '🌤️',
    fog: '🌫️',
    drizzle: '🌦️',
    rain: '🌧️',
    snow: '❄️',
    thunderstorm: '🌩️',
    cloudy: '☁️'
};

export const getWeatherDescription = (code) => WEATHER_CODE_MAP[code] || 'Unknown';

export const getWeatherEmoji = (code) => {
    if (code === 0) return WEATHER_EMOJI_MAP.clear;
    if (code <= 3) return WEATHER_EMOJI_MAP.partlyCloudy;
    if (code <= 48) return WEATHER_EMOJI_MAP.fog;
    if (code <= 55) return WEATHER_EMOJI_MAP.drizzle;
    if (code <= 65) return WEATHER_EMOJI_MAP.rain;
    if (code <= 75) return WEATHER_EMOJI_MAP.snow;
    if (code <= 95) return WEATHER_EMOJI_MAP.thunderstorm;
    return WEATHER_EMOJI_MAP.cloudy;
};