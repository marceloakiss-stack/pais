const form = document.querySelector('#location-form');
const status = document.querySelector('#form-status');
const report = document.querySelector('#report');
const emptyState = document.querySelector('#empty-state');
const clearButton = document.querySelector('#clear-button');
const themeButton = document.querySelector('#theme-button');
const historyToggle = document.querySelector('#history-toggle');
const privacyNote = document.querySelector('#privacy-note');
const historyChips = document.querySelector('#history-chips');

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
}

/* ---------- utilidades ---------- */

const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
const number = (value, digits = 0) => value == null || Number.isNaN(value) ? null : Number(value).toFixed(digits);

async function request(url, options = {}, timeoutMs = 12000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        if (!response.ok) throw new Error(`Proveedor no disponible (${response.status}).`);
        return response.json();
    } finally {
        clearTimeout(timeout);
    }
}

/* ---------- iconos (trazo fino, heredan color) ---------- */

const icon = {
    hospital: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M12 8v8M8 12h8"/></svg>',
    school: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 4 2 9l10 5 10-5-10-5z"/><path d="M6 11.5V17c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-5.5"/></svg>',
    cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 4h2l2.4 11.4a2 2 0 0 0 2 1.6h7.2a2 2 0 0 0 2-1.6L20 8H6"/><circle cx="9.5" cy="20" r="1.2"/><circle cx="17" cy="20" r="1.2"/></svg>',
    pharmacy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 8v8M8 12h8"/></svg>',
    restaurant: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 3v7a2 2 0 0 0 4 0V3M8 10v11M18 3c-2 1-2 4-2 6s.5 3 2 3v9"/></svg>',
    transit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="4" width="16" height="13" rx="2"/><path d="M4 12h16M8 20l-1.5 2M16 20l1.5 2"/><circle cx="8" cy="16" r=".2"/><circle cx="16" cy="16" r=".2"/></svg>',
    park: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3 6 12h3l-4 6h5v3M12 3l6 9h-3l4 6h-7"/></svg>',
    clear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="5"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>',
    cloud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M7 18a4 4 0 0 1-.4-8 5 5 0 0 1 9.6-1.8A4.5 4.5 0 0 1 17 18H7z"/></svg>',
    rain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M7 15a4 4 0 0 1-.4-8 5 5 0 0 1 9.6-1.8A4.5 4.5 0 0 1 17 15H7z"/><path d="M8 19l-1 2M12 19l-1 2M16 19l-1 2"/></svg>',
    storm: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M7 13a4 4 0 0 1-.4-8 5 5 0 0 1 9.6-1.8A4.5 4.5 0 0 1 17 13H7z"/><path d="M13 13l-3 5h3l-2 4"/></svg>',
    snow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M7 13a4 4 0 0 1-.4-8 5 5 0 0 1 9.6-1.8A4.5 4.5 0 0 1 17 13H7z"/><path d="M12 15v6M9.5 17.5l5 3M14.5 17.5l-5 3"/></svg>',
    fog: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 10h6M4 14h16M6 18h12"/></svg>',
};

function weatherIcon(code) {
    if (code == null) return icon.cloud;
    if (code === 0 || code === 1) return icon.clear;
    if ([2, 3, 45, 48].includes(code)) return code >= 45 ? icon.fog : icon.cloud;
    if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return icon.rain;
    if ([71, 73, 75, 77, 85, 86].includes(code)) return icon.snow;
    if ([95, 96, 99].includes(code)) return icon.storm;
    return icon.cloud;
}

/* ---------- categorías de servicios cercanos (una sola consulta a Overpass) ---------- */

const CATEGORIES = [
    { id: 'hospital', label: 'Salud', tag: 'amenity=hospital' },
    { id: 'school', label: 'Educación', tag: 'amenity=school' },
    { id: 'supermarket', label: 'Compras', tag: 'shop=supermarket' },
    { id: 'pharmacy', label: 'Farmacias', tag: 'amenity=pharmacy' },
    { id: 'restaurant', label: 'Restaurantes', tag: 'amenity=restaurant' },
    { id: 'transit', label: 'Transporte', tag: 'amenity=bus_station' },
    { id: 'transit2', label: 'Transporte', tag: 'railway=station', mergeInto: 'transit' },
    { id: 'park', label: 'Parques', tag: 'leisure=park' },
];

async function geocode(query) {
    let results;
    try {
        results = await request(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&accept-language=es&q=${encodeURIComponent(query)}`, { headers: { Accept: 'application/json' } });
    } catch (error) {
        if (error.message.includes('429')) throw new Error('El mapa está limitando consultas. Espera unos segundos y vuelve a intentarlo.');
        throw new Error('No se pudo consultar el mapa. Comprueba tu conexión.');
    }
    if (!results.length) throw new Error('No encontramos esa localidad. Revisa el nombre y la provincia.');
    return results[0];
}

async function weather(latitude, longitude) {
    try {
        const data = await request(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,uv_index_max&timezone=auto&forecast_days=1`);
        return {
            current: data.current?.temperature_2m,
            code: data.current?.weather_code,
            min: data.daily?.temperature_2m_min?.[0],
            max: data.daily?.temperature_2m_max?.[0],
            uv: data.daily?.uv_index_max?.[0],
            unit: data.current_units?.temperature_2m || '°C',
            timezone: data.timezone,
        };
    } catch { return null; }
}

async function airQuality(latitude, longitude) {
    try {
        const data = await request(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=us_aqi,pm2_5`);
        return { aqi: data.current?.us_aqi, pm25: data.current?.pm2_5 };
    } catch { return null; }
}

async function elevation(latitude, longitude) {
    try {
        const data = await request(`https://api.open-meteo.com/v1/elevation?latitude=${latitude}&longitude=${longitude}`);
        return data.elevation?.[0] ?? null;
    } catch { return null; }
}

async function countryInfo(countryName) {
    if (!countryName) return null;
    try {
        const data = await request(`https://restcountries.com/v3.1/name/${encodeURIComponent(countryName)}?fields=population,languages,currencies`, {}, 8000);
        const country = Array.isArray(data) ? data[0] : data;
        if (!country) return null;
        return {
            population: country.population ?? null,
            languages: country.languages ? Object.values(country.languages).join(', ') : null,
            currencies: country.currencies ? Object.values(country.currencies).map((currency) => `${currency.name}${currency.symbol ? ` (${currency.symbol})` : ''}`).join(', ') : null,
        };
    } catch { return null; }
}

async function nearbyAll(latitude, longitude, radius = 12000) {
    const clauses = CATEGORIES.map(({ tag }) => { const [key, value] = tag.split('='); return `nwr[${key}=${value}](around:${radius},${latitude},${longitude});`; }).join('');
    const query = `[out:json][timeout:20];(${clauses});out center 70;`;
    const buckets = Object.fromEntries(CATEGORIES.filter((category) => !category.mergeInto).map((category) => [category.id, []]));
    try {
        const data = await request(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`, {}, 20000);
        for (const element of data.elements) {
            const tags = element.tags || {};
            const match = CATEGORIES.find(({ tag }) => { const [key, value] = tag.split('='); return tags[key] === value; });
            if (!match) continue;
            const bucketId = match.mergeInto || match.id;
            if (buckets[bucketId].length < 5) buckets[bucketId].push({ name: tags.name || 'Lugar sin nombre' });
        }
    } catch { /* se muestran los buckets vacíos con su propio mensaje */ }
    return buckets;
}

/* ---------- gobierno (dato público verificable vía Wikidata) ---------- */

async function governmentInfo(countryCode) {
    if (!countryCode) return null;
    const query = `SELECT (GROUP_CONCAT(DISTINCT ?govLabel; separator=", ") AS ?governmentForms) (SAMPLE(?article) AS ?wikiArticle) WHERE {
      ?country wdt:P297 "${countryCode.toUpperCase()}".
      OPTIONAL { ?country wdt:P122 ?gov. }
      OPTIONAL { ?article schema:about ?country; schema:isPartOf <https://es.wikipedia.org/>. }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
    } GROUP BY ?country`;
    try {
        const data = await request(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`, { headers: { Accept: 'application/sparql-results+json' } }, 10000);
        const row = data.results?.bindings?.[0];
        const forms = row?.governmentForms?.value || null;
        const wikiUrl = row?.wikiArticle?.value || null;
        if (!forms && !wikiUrl) return null;
        return { forms, wikiUrl };
    } catch { return null; }
}

/* ---------- distancia real a la costa (OpenStreetMap, sin inventar cifras) ---------- */

function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const toRad = (value) => (value * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

async function coastDistance(latitude, longitude) {
    const searchRadii = [60000, 180000, 450000];
    for (const radius of searchRadii) {
        try {
            const query = `[out:json][timeout:20];way(around:${radius},${latitude},${longitude})[natural=coastline];out geom 25;`;
            const data = await request(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`, {}, 20000);
            if (!data.elements?.length) continue;
            let min = Infinity;
            for (const way of data.elements) {
                for (const node of way.geometry || []) {
                    const distance = haversineKm(latitude, longitude, node.lat, node.lon);
                    if (distance < min) min = distance;
                }
            }
            if (Number.isFinite(min)) return { km: min, wideSearch: radius > searchRadii[0] };
        } catch { /* probar el siguiente radio de búsqueda */ }
    }
    return null;
}

function numbeoUrl(place) {
    return `https://www.numbeo.com/crime/in/${encodeURIComponent(place.trim().replace(/\s+/g, '-'))}`;
}

/* ---------- historial local (opt-in) ---------- */

const HISTORY_KEY = 'atlas-history';
const historyEnabled = () => localStorage.getItem('atlas-history-enabled') === 'true';

function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}

function saveToHistory(entry) {
    if (!historyEnabled()) return;
    const items = loadHistory().filter((item) => item.query !== entry.query);
    items.unshift(entry);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 8)));
    renderHistory();
}

function renderHistory() {
    const items = historyEnabled() ? loadHistory() : [];
    historyChips.classList.toggle('hidden', items.length === 0);
    historyChips.innerHTML = items.map((item) => `<button type="button" class="chip" data-country="${escapeHtml(item.country)}" data-region="${escapeHtml(item.region)}" data-place="${escapeHtml(item.place)}">${escapeHtml(item.place)}</button>`).join('');
}

historyChips.addEventListener('click', (event) => {
    const chip = event.target.closest('.chip');
    if (!chip) return;
    document.querySelector('#country').value = chip.dataset.country;
    document.querySelector('#region').value = chip.dataset.region;
    document.querySelector('#place').value = chip.dataset.place;
    form.requestSubmit();
});

historyToggle.checked = historyEnabled();
privacyNote.textContent = historyEnabled() ? 'Historial local activo' : 'Sin almacenamiento';
renderHistory();

historyToggle.addEventListener('change', () => {
    localStorage.setItem('atlas-history-enabled', historyToggle.checked ? 'true' : 'false');
    privacyNote.textContent = historyToggle.checked ? 'Historial local activo' : 'Sin almacenamiento';
    if (!historyToggle.checked) localStorage.removeItem(HISTORY_KEY);
    renderHistory();
});

/* ---------- tema claro / oscuro ---------- */

function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('atlas-theme', theme);
}

themeButton.addEventListener('click', () => {
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});

/* ---------- render ---------- */

function placeList(items, label, iconKey) {
    if (!items) return `<article class="place-card skeleton"><div class="skeleton-line"></div><div class="skeleton-line short"></div></article>`;
    if (!items.length) return `<article class="place-card empty"><span class="place-icon">${icon[iconKey]}</span><b>${escapeHtml(label)}</b><p>Nada en 12 km a la redonda.</p></article>`;
    return `<article class="place-card"><span class="place-icon">${icon[iconKey]}</span><b>${escapeHtml(label)}</b>${items.map((item) => `<p>${escapeHtml(item.name)}</p>`).join('')}</article>`;
}

function skeletonStat() {
    return `<article class="data-card skeleton"><div class="skeleton-line short"></div><div class="skeleton-line"></div></article>`;
}

function shellReport(location) {
    const displayName = location.display_name.split(',').slice(0, 2).join(',');
    const sourceMap = `https://www.openstreetmap.org/?mlat=${location.lat}&mlon=${location.lon}#map=13/${location.lat}/${location.lon}`;
    report.innerHTML = `
    <div class="report-head"><div><p class="eyebrow">Informe temporal</p><h2>${escapeHtml(displayName)}</h2><p class="report-meta">Coordenadas ${Number(location.lat).toFixed(4)}, ${Number(location.lon).toFixed(4)} · actualizado ${new Date().toLocaleDateString('es-ES')}</p></div><button class="export-button" id="export-button">Imprimir / PDF</button></div>
    <div class="data-grid" id="data-grid">${skeletonStat()}${skeletonStat()}${skeletonStat()}${skeletonStat()}${skeletonStat()}${skeletonStat()}</div>
    <section class="report-section"><h3>Servicios cercanos <span>OPENSTREETMAP</span></h3><div class="places" id="places-grid">${CATEGORIES.filter((c) => !c.mergeInto).map(() => placeList(null)).join('')}</div></section>
    <section class="report-section"><h3>Gobierno, costa y seguridad</h3><div class="places" id="context-grid">${placeList(null)}${placeList(null)}${placeList(null)}</div></section>
    <section class="report-section"><h3>Fuentes</h3><div class="sources" id="sources-list"><a href="${sourceMap}" target="_blank" rel="noreferrer">Mapa y lugares cercanos</a><a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a><a href="https://restcountries.com/" target="_blank" rel="noreferrer">REST Countries</a><a href="https://www.wikidata.org/" target="_blank" rel="noreferrer">Wikidata</a><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">Datos cartográficos</a></div></section>
    <p class="disclaimer">Este informe se genera en el dispositivo${historyEnabled() ? '; solo el nombre de la localidad se guarda en tu historial local' : ' y no se guarda'}. La seguridad enlaza a Numbeo (datos de comunidad, no oficiales) y el gobierno a Wikidata; contrasta siempre con fuentes oficiales antes de tomar decisiones.</p>`;
    report.classList.remove('hidden'); emptyState.classList.add('hidden');
    document.querySelector('#export-button').addEventListener('click', () => window.print());
}

function fillDataGrid({ location, climate, air, elevationValue, country }) {
    const grid = document.querySelector('#data-grid');
    if (!grid) return;
    grid.innerHTML = `
      <article class="data-card"><small>Ubicación</small><strong>${escapeHtml(location.address?.country || 'No disponible')}</strong><p>${escapeHtml(location.address?.state || location.address?.region || 'Región no identificada')}</p></article>
      <article class="data-card"><small>Clima actual</small><span class="data-icon">${weatherIcon(climate?.code)}</span><strong>${climate?.current != null ? `${climate.current}${climate.unit}` : 'No disponible'}</strong><p>Máx. ${climate?.max ?? '—'}${climate?.unit || ''} · Mín. ${climate?.min ?? '—'}${climate?.unit || ''}</p></article>
      <article class="data-card"><small>Índice UV / aire</small><strong>${climate?.uv != null ? number(climate.uv, 1) : '—'}</strong><p>${air?.aqi != null ? `AQI ${air.aqi} (EE. UU.)` : 'Calidad del aire no disponible'}</p></article>
      <article class="data-card"><small>Elevación</small><strong>${elevationValue != null ? `${Math.round(elevationValue)} m` : 'No disponible'}</strong><p>${climate?.timezone ? `Zona horaria: ${climate.timezone}` : 'Zona horaria no disponible'}</p></article>
      <article class="data-card"><small>Población del país</small><strong>${country?.population ? country.population.toLocaleString('es-ES') : 'No disponible'}</strong><p>${country?.languages ? `Idiomas: ${country.languages}` : 'Idiomas no disponibles'}</p></article>
      <article class="data-card"><small>Moneda</small><strong>${country?.currencies ? country.currencies.split(' (')[0] : 'No disponible'}</strong><p>${country?.currencies || 'Sin datos de moneda'}</p></article>`;
}

function fillPlaces(buckets) {
    const grid = document.querySelector('#places-grid');
    if (!grid) return;
    const visible = CATEGORIES.filter((c) => !c.mergeInto);
    grid.innerHTML = visible.map(({ id, label }) => placeList(buckets[id], label, id)).join('');
}

function fillContext({ government, coast, place }) {
    const grid = document.querySelector('#context-grid');
    if (!grid) return;
    const governmentCard = `<article class="place-card"><b>Gobierno</b><p>${government?.forms ? escapeHtml(government.forms) : 'No disponible en Wikidata para este país.'}</p>${government?.wikiUrl ? `<p><a href="${government.wikiUrl}" target="_blank" rel="noreferrer">Ver en Wikipedia →</a></p>` : ''}</article>`;
    const coastCard = coast
        ? `<article class="place-card"><b>Costa más cercana</b><p>Aprox. ${coast.km < 1 ? `${Math.round(coast.km * 1000)} m` : `${number(coast.km, coast.km < 20 ? 1 : 0)} km`} en línea recta${coast.wideSearch ? ' (búsqueda ampliada)' : ''}.</p></article>`
        : `<article class="place-card empty"><b>Costa más cercana</b><p>No se encontró costa en un radio de 450 km.</p></article>`;
    const securityCard = `<article class="place-card"><b>Seguridad</b><p>No existe una fuente abierta fiable con cifras por localidad; consulta el índice de percepción de Numbeo.</p><p><a href="${numbeoUrl(place)}" target="_blank" rel="noreferrer">Ver en Numbeo →</a></p></article>`;
    grid.innerHTML = governmentCard + coastCard + securityCard;
    const sources = document.querySelector('#sources-list');
    if (sources && !sources.querySelector('[data-numbeo]')) {
        sources.insertAdjacentHTML('beforeend', `<a data-numbeo href="${numbeoUrl(place)}" target="_blank" rel="noreferrer">Numbeo</a>`);
    }
}

/* ---------- flujo principal ---------- */

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const country = document.querySelector('#country').value.trim();
    const region = document.querySelector('#region').value.trim();
    const place = document.querySelector('#place').value.trim();
    status.textContent = 'Localizando…';
    const button = form.querySelector('button'); button.disabled = true;
    try {
        const location = await geocode([place, region, country].filter(Boolean).join(', '));
        shellReport(location);
        status.textContent = 'Completando el informe con clima, aire y servicios cercanos…';

        const [climate, air, elevationValue, country_, buckets, government, coast] = await Promise.all([
            weather(location.lat, location.lon),
            airQuality(location.lat, location.lon),
            elevation(location.lat, location.lon),
            countryInfo(location.address?.country),
            nearbyAll(location.lat, location.lon),
            governmentInfo(location.address?.country_code),
            coastDistance(location.lat, location.lon),
        ]);

        fillDataGrid({ location, climate, air, elevationValue, country: country_ });
        fillPlaces(buckets);
        fillContext({ government, coast, place: place || location.display_name.split(',')[0] });
        saveToHistory({ query: [place, region, country].filter(Boolean).join(', '), country, region, place });
        status.textContent = 'Informe listo. Puedes imprimirlo o guardarlo como PDF.';
    } catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; }
});

clearButton.addEventListener('click', () => { form.reset(); report.innerHTML = ''; report.classList.add('hidden'); emptyState.classList.remove('hidden'); status.textContent = 'Investigación eliminada del dispositivo.'; });
