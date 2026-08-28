const form = document.querySelector('#location-form');
const status = document.querySelector('#form-status');
const report = document.querySelector('#report');
const emptyState = document.querySelector('#empty-state');
const clearButton = document.querySelector('#clear-button');

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
}

const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
const km = (meters) => meters == null ? 'No disponible' : `${(meters / 1000).toFixed(1)} km`;

async function request(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        if (!response.ok) throw new Error(`Proveedor no disponible (${response.status}).`);
        return response.json();
    } finally {
        clearTimeout(timeout);
    }
}

async function geocode(query) {
    let results;
    try {
        results = await request(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&q=${encodeURIComponent(query)}`, { headers: { Accept: 'application/json' } });
    } catch (error) {
        if (error.message.includes('429')) throw new Error('El mapa está limitando consultas. Espera unos segundos y vuelve a intentarlo.');
        throw new Error('No se pudo consultar el mapa. Comprueba tu conexión.');
    }
    if (!results.length) throw new Error('No encontramos esa localidad. Revisa el nombre y la provincia.');
    return results[0];
}

async function weather(latitude, longitude) {
    try {
        const data = await request(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`);
        return { current: data.current?.temperature_2m, min: data.daily?.temperature_2m_min?.[0], max: data.daily?.temperature_2m_max?.[0], unit: data.current_units?.temperature_2m || '°C' };
    } catch { return null; }
}

async function nearby(latitude, longitude, type) {
    const query = `[out:json][timeout:12];(nwr[amenity=${type}](around:15000,${latitude},${longitude});nwr[shop=${type}](around:15000,${latitude},${longitude}););out center 5;`;
    try {
        const data = await request(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
        return data.elements.map((item) => ({ name: item.tags?.name || 'Lugar sin nombre', type: item.tags?.amenity || item.tags?.shop || type })).slice(0, 5);
    } catch { return []; }
}

function placeList(items, emptyLabel) {
    if (!items.length) return `<div class="place-card"><b>${emptyLabel}</b><p>No se encontraron resultados en un radio de 15 km.</p></div>`;
    return items.map((item) => `<div class="place-card"><b>${escapeHtml(item.name)}</b><p>${escapeHtml(item.type)}</p></div>`).join('');
}

function renderReport(location, climate, hospitals, schools, shops) {
    const displayName = location.display_name.split(',').slice(0, 2).join(',');
    const sourceMap = `https://www.openstreetmap.org/?mlat=${location.lat}&mlon=${location.lon}#map=13/${location.lat}/${location.lon}`;
    report.innerHTML = `<div class="report-head"><div><p class="eyebrow">Informe temporal</p><h2>${escapeHtml(displayName)}</h2><p class="report-meta">Coordenadas ${Number(location.lat).toFixed(4)}, ${Number(location.lon).toFixed(4)} · actualizado ${new Date().toLocaleDateString('es-ES')}</p></div><button class="export-button" id="export-button">Imprimir / PDF</button></div>
    <div class="data-grid">
      <article class="data-card"><small>Ubicación</small><strong>${escapeHtml(location.address?.country || 'No disponible')}</strong><p>${escapeHtml(location.address?.state || location.address?.region || 'Región no identificada')}</p></article>
      <article class="data-card"><small>Clima actual</small><strong>${climate?.current != null ? `${climate.current}${climate.unit}` : 'No disponible'}</strong><p>Máx. ${climate?.max ?? '—'}${climate?.unit || ''} · Mín. ${climate?.min ?? '—'}${climate?.unit || ''}</p></article>
      <article class="data-card"><small>Servicios hallados</small><strong>${hospitals.length + schools.length + shops.length}</strong><p>en un radio aproximado de 15 km</p></article>
    </div>
    <section class="report-section"><h3>Servicios cercanos <span>OPENSTREETMAP</span></h3><div class="places">${placeList(hospitals, 'Salud')} ${placeList(schools, 'Educación')} ${placeList(shops, 'Compras')}</div></section>
    <section class="report-section"><h3>Investigación pendiente</h3><div class="places"><div class="place-card"><b>Gobierno y demografía</b><p>Habitantes, religión y orientación política requieren una fuente oficial o editorial verificable para este lugar.</p></div><div class="place-card"><b>Economía y transporte</b><p>Ingresos principales, conexión con ciudades mayores y transporte requieren consulta contextual.</p></div><div class="place-card"><b>Agua y costa</b><p>La distancia al mar y zonas de baño deben validarse con mapas y autoridades locales.</p></div></div></section>
    <section class="report-section"><h3>Fuentes</h3><div class="sources"><a href="${sourceMap}" target="_blank" rel="noreferrer">Mapa y lugares cercanos</a><a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">Datos cartográficos</a></div></section>
    <p class="disclaimer">Este informe se genera en el dispositivo y no se guarda. Comprueba los datos sensibles, teléfonos y horarios en las fuentes oficiales antes de tomar decisiones.</p>`;
    report.classList.remove('hidden'); emptyState.classList.add('hidden');
    document.querySelector('#export-button').addEventListener('click', () => window.print());
}

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const country = document.querySelector('#country').value.trim();
    const region = document.querySelector('#region').value.trim();
    const place = document.querySelector('#place').value.trim();
    status.textContent = 'Consultando mapas, clima y servicios cercanos…';
    const button = form.querySelector('button'); button.disabled = true;
    try {
        const location = await geocode([place, region, country].filter(Boolean).join(', '));
        const [climate, hospitals, schools, shops] = await Promise.all([weather(location.lat, location.lon), nearby(location.lat, location.lon, 'hospital'), nearby(location.lat, location.lon, 'school'), nearby(location.lat, location.lon, 'supermarket')]);
        renderReport(location, climate, hospitals, schools, shops);
        status.textContent = 'Informe listo. Puedes imprimirlo o guardarlo como PDF.';
    } catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; }
});

clearButton.addEventListener('click', () => { form.reset(); report.innerHTML = ''; report.classList.add('hidden'); emptyState.classList.remove('hidden'); status.textContent = 'Investigación eliminada del dispositivo.'; });
