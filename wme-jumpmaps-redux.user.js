// ==UserScript==
// @name         WME JumpMapsRedux
// @description  Швидкі переходи з WME на інші картографічні ресурси (Bookmarks/Favorites) та навпаки — в окремому вікні. Підтримує OSM, Google, Yandex, 2GIS, Bing, Here, Apple Maps, Mapillary, Wikimapia, Visicom, satellites.pro та інші. Зберігає позицію плаваючої панелі. Не використовує та не копіює сторонні дані, не порушує інтелектуальної власності. Переписано під офіційний WME SDK v2, без залежності від WazeWrap.
// @license      MIT
// @version      6.0.0
// @author       skirda, alexletov, Claude (Anthropic)
// @include      https://*.waze.com/*editor*
// @include      https://n.maps.yandex.ru/*
// @include      /^https?://maps\.yandex\.(ru|by)/*$/
// @include      /^https?://yandex\.(ru|by)/maps.*$/
// @include      https://www.google.*/maps*
// @include      https://www.google.com.*/maps*
// @include      https://maps.google.*
// @include      http://maps.google.*
// @include      /^https?://2gis\.(ru|ua|kz|kg|ae|cl|com\.cy|cz|it)/.*$/
// @include      http://mapcam.info/speedcam/*
// @include      https://mapcam.info/speedcam/*
// @include      https://speedcamonline.ru/*
// @include      /^https?://.*\.rosreestr\.ru/.*$/
// @include      http://wikimapia.org/*
// @include      https://wikimapia.org/*
// @include      http://*.balticmaps.eu/*
// @include      https://*.balticmaps.eu/*
// @include      http://www.openstreetmap.org/*
// @include      https://www.openstreetmap.org/*
// @include      https://www.mapillary.com/*
// @include      https://map.land.gov.ua/*
// @include      https://mapilio.com/app*
// @include      https://kartaview.org/map/*
// @include      https://www.bing.com/maps*
// @include      http://www.bing.com/maps*
// @include      https://wego.here.com/*
// @include      https://maps.apple.com/*
// @include      https://maps.visicom.ua/*
// @include      https://satellites.pro/*
// @match        https://*.waze.com/*map-editor/*
// @match        https://*.waze.com/*editor*
// @match        https://*.waze.com/*beta_editor/*
// @require      https://cdn.jsdelivr.net/npm/proj4@2.20.8/dist/proj4.js
// @updateURL    https://raw.githubusercontent.com/SapozhnikUA/WME-JumpMapsRedux/main/wme-jumpmaps-redux.user.js
// @downloadURL  https://raw.githubusercontent.com/SapozhnikUA/WME-JumpMapsRedux/main/wme-jumpmaps-redux.user.js
// @grant        none
// ==/UserScript==

/* global proj4, getWmeSdk, SDK_INITIALIZED */
'use strict';

// ═══════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════
const SCRIPT_ID      = 'wme-jumpmaps';
const SCRIPT_NAME    = 'WME JumpMapsRedux';
const SCRIPT_VERSION = '6.0.0';
const FLOAT_ID       = 'wmejm-floatbar';

const DEFAULT_LEFT   = '400px';
const DEFAULT_TOP    = '100px';

const LS = {
    LINK    : 'WMEJumpMapsLink',
    DEBUG   : 'WMEJumpMapsDebug',
    RESTORE : 'WMEJumpMapsRestoreSelected',
    HIDE    : 'WMEJumpMapsHideWindow',
    TOP     : 'WMEJumpMapsTopOffset',
    LEFT    : 'WMEJumpMapsLeftOffset',
};

// ═══════════════════════════════════════════════════════════════
// proj4 coordinate system definitions
// ═══════════════════════════════════════════════════════════════
proj4.defs([
    ['EPSG:3857', '+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +over +no_defs'],
    ['EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs'],
    ['EPSG:3059', '+proj=tmerc +lat_0=0 +lon_0=24 +k=0.9996 +x_0=500000 +y_0=-6000000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'],
    ['EPSG:3346', '+proj=tmerc +lat_0=0 +lon_0=24 +k=0.9998 +x_0=500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'],
]);

// ═══════════════════════════════════════════════════════════════
// Runtime state
// ═══════════════════════════════════════════════════════════════
let sdk = null;  // WME SDK v2 instance — set inside initWME()

let cfg = {
    debug          : false,
    restoreSelected: false,
    hideWindow     : false,
    topOffset      : DEFAULT_TOP,
    leftOffset     : DEFAULT_LEFT,
};

// ═══════════════════════════════════════════════════════════════
// Default map definitions
//   save:1 → shown in the floating bar by default
//   save:0 → disabled by default, user can enable via settings
// ═══════════════════════════════════════════════════════════════
const DEFAULT_MAPS = {
    // Waze internal — never shown in the bar, used only for link building
    _map_WME    : { save:0, title:'Open in WME',               name:'[WME]',   template:'https://www.waze.com/editor/?env=row&zoomLevel={{zoom}}&lat={{lat}}&lon={{lon}}' },
    _map_WMEB   : { save:0, title:'Open in WME Beta',          name:'[WMEB]',  template:'https://beta.waze.com/editor/?env=row&zoomLevel={{zoom}}&lat={{lat}}&lon={{lon}}' },
    _map_LI     : { save:0, title:'Open in LiveMap',           name:'[Live]',  template:'https://www.waze.com/livemap/?zoom={{zoom}}&lon={{lon}}&lat={{lat}}' },
    // Third-party — default ON
    _map_OSM    : { save:1, title:'Open in OSM',               name:'[OSM]',   template:'http://www.openstreetmap.org/#map={{zoom}}/{{lat}}/{{lon}}' },
    _map_BING   : { save:1, title:'Open in Bing Map',          name:'[Bing]',  template:'http://www.bing.com/maps/?v=2&cp={{lat}}~{{lon}}&lvl={{zoom}}&dir=0&sty=h&form=LMLTEW' },
    _map_HERE   : { save:1, title:'Open in Here Map',          name:'[Here]',  template:'https://wego.here.com/?map={{lat}},{{lon}},{{zoom}},normal' },
    _map_AM     : { save:1, title:'Open in Apple Map',         name:'[AM]',    template:'http://maps.apple.com/?ll={{lat}},{{lon}}&z={{zoom}}' },
    _map_MRY    : { save:1, title:'Open in Mapillary',         name:'[MRY]',   template:'https://www.mapillary.com/app/?lat={{lat}}&lng={{lon}}&z={{zoom}}' },
    _map_WM     : { save:1, title:'Open in Wikimapia',         name:'[WM]',    template:'http://wikimapia.org/#lang=ru&lat={{lat}}&lon={{lon}}&z={{zoom}}&m=b' },
    _map_VCUA   : { save:1, title:'Open in maps.visicom.ua',   name:'[VCUA]',  template:'https://maps.visicom.ua/c/{{lon}},{{lat}},{{zoom}}?lang=uk' },
    _map_SPRO   : { save:1, title:'Open in satellites.pro',    name:'[SPRO]',  template:'https://satellites.pro/#{{lat}},{{lon}},{{zoom}}' },
    // Third-party — default OFF
    _map_Google : { save:0, title:'Open in Google Map',        name:'[G]',     template:'http://www.google.com/maps/?ll={{lat}}%2C{{lon}}&z={{zoom}}&t=m' },
    _map_YM     : { save:0, title:'Open in Yandex Map',        name:'[YM]',    template:'http://maps.yandex.ru/?ll={{lon}}%2C{{lat}}&z={{zoom}}&l=pmap%2Cstv' },
    _map_NM     : { save:0, title:'Open in Yandex Narod',      name:'[NYM]',   template:'https://n.maps.yandex.ru/?ll={{lon}}%2C{{lat}}&z={{zoom}}&l=pmap' },
    _map_2GIS   : { save:0, title:'Open in 2GIS',              name:'[2Gis]',  template:'http://2gis.ru/{{city}}?m={{lon}}%2C{{lat}}%2F{{zoom}}' },
    _map_KVIEW  : { save:0, title:'Open in KartaView',         name:'[KVIEW]', template:'http://kartaview.org/map/@{{lat}},{{lon}},{{zoom}}z' },
    _map_MPLIO  : { save:0, title:'Open in Mapilio',           name:'[MPLIO]', template:'https://mapilio.com/app?lat={{lat}}&lng={{lon}}&zoom={{zoom}}' },
    _map_SC     : { save:0, title:'Open in mapcam.info',       name:'[SC]',    template:'http://mapcam.info/speedcam/?lng={{lon}}&lat={{lat}}&z={{zoom}}&t=OSM' },
    _map_SC2    : { save:0, title:'Open in SpeedCamOnLine',    name:'[SCO]',   template:'http://speedcamonline.ru/view/Rus/{{lat}}/{{lon}}/{{zoom}}' },
    _map_KADUA  : { save:0, title:'Open in Kadastr UA',        name:'[KADUA]', template:'http://map.land.gov.ua/?cc={{lon}},{{lat}}&z={{zoom}}&l=kadastr' },
    _map_RE     : { save:0, title:'Open in RosReestr',         name:'[RE]',    template:'https://pkk.rosreestr.ru/#/search/{{lat}},{{lon}}/{{zoom}}' },
    _map_BP     : { save:0, title:'Open in benzin-price.ru',   name:'[BP]',    template:'http://www.benzin-price.ru/m/index.php?lat={{lat}}&lon={{lon}}&distance=1' },
    _map_BM     : { save:0, title:'Open in Baltic Maps',       name:'[BM]',    template:'https://balticmaps.eu/lv/c___{{lon}}-{{lat}}-{{zoom}}/bl___cl' },
    _map_AMR    : { save:0, title:'Open in atlas.mos.ru',      name:'[AMR]',   template:'https://atlas.mos.ru/?lang=ru&z={{zoom}}&ll={{lon}}%2C{{lat}}' },
    _map_KLIVE  : { save:0, title:'Open in kadastr.live',      name:'[KLIVE]', template:'https://kadastr.live/#{{zoom}}/{{lat}}/{{lon}}' },
    _map_RBASE  : { save:0, title:'Open in radarbase.info',    name:'[RBASE]', template:'https://radarbase.info/map/actual/{{lat}}/{{lon}}/{{zoom}}' },
    _map_RRSTR  : { save:0, title:'Open in rreestrmap.ru',     name:'[RREE]',  template:'https://rreestrmap.ru/?lat={{lat}}&lng={{lon}}&zoom={{zoom}}' },
    _map_WMFLAB : { save:0, title:'Open in tools.wmflabs.org', name:'[WMF]',   template:'https://tools.wmflabs.org/geohack/geohack.php?params={{lat}}_N_{{lon}}_E_scale:{{zoom}}' },
};

// Working copy, populated in loadMapDefs()
let mapDefs = {};

// ═══════════════════════════════════════════════════════════════
// Small utilities
// ═══════════════════════════════════════════════════════════════
const log = (...a) => cfg.debug && console.log(`[WME-JM ${SCRIPT_VERSION}]`, ...a);

function lsGet(key, type, def) {
    const raw = localStorage.getItem(key);
    if (raw === null) return def;
    if (type === 'bool') return raw === 'true' || raw === '1';
    return raw;
}

function deepClone(o) { return JSON.parse(JSON.stringify(o)); }
function isJson(s)    { try { JSON.parse(s); return true; } catch { return false; } }

/** Read one query-string value from a URL string. Returns null if not found. */
function qs(url, name) {
    const pos = url.indexOf(name + '=');
    if (pos < 0) return null;
    const start = pos + name.length + 1;
    const end   = url.indexOf('&', start);
    return end < 0 ? url.slice(start) : url.slice(start, end);
}

// ═══════════════════════════════════════════════════════════════
// Site detection
// ═══════════════════════════════════════════════════════════════
function getLocationType() {
    const h = location.hostname;
    const p = location.pathname;
    if (h === 'www.waze.com' || h === 'beta.waze.com' || h === 'editor-beta.waze.com') return 'waze';
    if (h === 'n.maps.yandex.ru') return 'NM';
    if ((h === 'yandex.ru' || h === 'yandex.by') && p.includes('/maps')) return 'YM';
    if (h === 'maps.google.com' || h.startsWith('www.google.')) return 'google';
    if (/^2gis\.(ru|ua|kz|kg)$/.test(h)) return '2gis';
    if (h.includes('.rosreestr.ru')) return 're';
    if (h === 'mapcam.info') return 'sc';
    if (h === 'speedcamonline.ru') return 'sco';
    if (h === 'wikimapia.org') return 'wm';
    if (h === 'balticmaps.eu' || h.endsWith('.balticmaps.eu')) return 'bm';
    if (h === 'www.openstreetmap.org') return 'osm';
    if (h === 'www.mapillary.com') return 'mry';
    if (h === 'kartaview.org') return 'kview';
    if (h === 'mapilio.com' && p.includes('/app')) return 'mapilio';
    if (h === 'map.land.gov.ua') return 'kadua';
    if (h === 'www.bing.com' && p.includes('/maps')) return 'bing';
    if (h === 'wego.here.com') return 'here';
    if (h === 'maps.apple.com') return 'apple';
    if (h === 'maps.visicom.ua') return 'vcua';
    if (h === 'satellites.pro') return 'spro';
    return '';
}

// ═══════════════════════════════════════════════════════════════
// Extract lat / lon / zoom from the current page
// ═══════════════════════════════════════════════════════════════
function getLLZ() {
    let lat = 0, lon = 0, zoom = 0, city = '';
    const href = location.href;
    const loc  = getLocationType();

    switch (loc) {

        case 'waze': {
            const center = sdk.Map.getMapCenter();
            zoom = sdk.Map.getZoomLevel();
            lat  = center.lat; lon = center.lon;
            break;
        }
        case 'NM': {
            zoom = parseInt(qs(href, 'z'));
            const nml = qs(href, 'll').split('%2C');
            lat = parseFloat(nml[1]); lon = parseFloat(nml[0]);
            break;
        }
        case 'YM': {
            let qll = qs(href, 'whatshere%5Bpoint%5D');
            let shortLink = false;
            if (!qll) { qll = qs(href, 'll'); shortLink = true; }
            if (qll) {
                const yml = qll.split('%2C');
                lat = parseFloat(yml[1]); lon = parseFloat(yml[0]);
                zoom = parseInt(qs(href, shortLink ? 'z' : 'whatshere%5Bzoom%5D'));
            }
            break;
        }
        case 'google': {
            const at = href.indexOf('@');
            if (at >= 0) {
                const gl = href.slice(at + 1).split(',');
                lat = parseFloat(gl[0]); lon = parseFloat(gl[1]); zoom = parseInt(gl[2]);
            } else {
                lat = parseFloat(qs(href, 'y')); lon = parseFloat(qs(href, 'x')); zoom = parseInt(qs(href, 'z'));
            }
            break;
        }
        case '2gis': {
            const f = href.split('=')[1].split('%2F');
            zoom = parseInt(f[1]);
            const dl = f[0].split('%2C');
            lon = parseFloat(dl[0]); lat = parseFloat(dl[1]);
            break;
        }
        case 're': {
            const rm = href.match(/\.rosreestr\.ru\/#\/search\/([\d.]+),([\d.]+)\/(\d+)/);
            if (rm) { lat = parseFloat(rm[1]); lon = parseFloat(rm[2]); zoom = parseInt(rm[3]); }
            break;
        }
        case 'sc': {
            lat = parseFloat(qs(href, 'lat')); lon = parseFloat(qs(href, 'lng')); zoom = parseInt(qs(href, 'z'));
            break;
        }
        case 'sco': {
            const pml = document.getElementById('permalink');
            if (pml) {
                const sv = new URL(pml.value).pathname.split('/');
                lat = parseFloat(sv[2]); lon = parseFloat(sv[3]); zoom = parseInt(sv[4]);
            }
            break;
        }
        case 'wm': {
            lat = parseFloat(qs(href, 'lat')); lon = parseFloat(qs(href, 'lon')); zoom = parseInt(qs(href, 'z'));
            break;
        }
        case 'bm': {
            const bmr = [...href.matchAll(/https?:\/\/balticmaps\.eu\/\S+\/c___(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)-(\d+)\//g)];
            if (bmr[0]) { lon = parseFloat(bmr[0][1]); lat = parseFloat(bmr[0][2]); zoom = parseInt(bmr[0][3]); }
            break;
        }
        case 'osm': {
            const om = href.match(/#map=(\d+)\/([\d.-]+)\/([\d.-]+)/);
            if (om) { zoom = parseInt(om[1]); lat = parseFloat(om[2]); lon = parseFloat(om[3]); }
            break;
        }
        case 'mry': {
            lat = parseFloat(qs(href, 'lat')); lon = parseFloat(qs(href, 'lng')); zoom = parseInt(qs(href, 'z'));
            break;
        }
        case 'kview': {
            const kvidx = href.indexOf('@');
            if (kvidx >= 0) {
                const kl = href.slice(kvidx + 1).split(',');
                lat = parseFloat(kl[0]); lon = parseFloat(kl[1]); zoom = Math.round(parseFloat(kl[2]));
            }
            break;
        }
        case 'mapilio': {
            lat = parseFloat(qs(href, 'lat')); lon = parseFloat(qs(href, 'lng'));
            zoom = Math.round(parseFloat(qs(href, 'zoom'))) + 1;
            break;
        }
        case 'kadua': {
            const cc = qs(href, 'cc');
            if (cc) { const kl2 = cc.split(','); lon = parseFloat(kl2[0]); lat = parseFloat(kl2[1]); }
            zoom = parseInt(qs(href, 'z'));
            break;
        }
        case 'bing': {
            const bcp = qs(href, 'cp');
            if (bcp) { const bp = bcp.split('~'); lat = parseFloat(bp[0]); lon = parseFloat(bp[1]); }
            zoom = parseInt(qs(href, 'lvl'));
            break;
        }
        case 'here': {
            const hm = qs(href, 'map');
            if (hm) { const hp = hm.split(','); lat = parseFloat(hp[0]); lon = parseFloat(hp[1]); zoom = parseInt(hp[2]); }
            break;
        }
        case 'apple': {
            const apl = qs(href, 'll');
            if (apl) { const ap = apl.split(','); lat = parseFloat(ap[0]); lon = parseFloat(ap[1]); }
            zoom = parseInt(qs(href, 'z'));
            break;
        }
        case 'vcua': {
            const vm = href.match(/\/c\/([\d.]+),([\d.]+),([\d.]+)/);
            if (vm) { lon = parseFloat(vm[1]); lat = parseFloat(vm[2]); zoom = parseInt(vm[3]); }
            break;
        }
        case 'spro': {
            const sm = href.match(/#([\d.-]+),([\d.-]+),([\d]+)/);
            if (sm) { lat = parseFloat(sm[1]); lon = parseFloat(sm[2]); zoom = parseInt(sm[3]); }
            break;
        }
        case 'klive': {
            const klm = href.match(/#([\d]+)\/([\d.-]+)\/([\d.-]+)/);
            if (klm) { zoom = parseInt(klm[1]); lat = parseFloat(klm[2]); lon = parseFloat(klm[3]); }
            break;
        }
        case 'rbase': {
            const rbm = href.match(/\/map\/actual\/([\d.-]+)\/([\d.-]+)\/([\d]+)/);
            if (rbm) { lat = parseFloat(rbm[1]); lon = parseFloat(rbm[2]); zoom = parseInt(rbm[3]); }
            break;
        }
        case 'rrstr': {
            lat = parseFloat(qs(href, 'lat')); lon = parseFloat(qs(href, 'lng'));
            zoom = parseInt(qs(href, 'zoom'));
            break;
        }
    }

    log('getLLZ()', loc, { lat, lon, zoom });
    return { lat, lon, zoom, city };
}

// ═══════════════════════════════════════════════════════════════
// Coordinate conversion: external site → WGS84 for WME permalink
// ═══════════════════════════════════════════════════════════════
function convertOther2WME(llz) {
    const loc = getLocationType();
    // Sites that store coords in EPSG:3857 (Web Mercator)
    if (loc === 'bm' || loc === 'kadua') {
        const c = proj4('EPSG:3857', 'EPSG:4326', [llz.lon, llz.lat]);
        llz.lon = c[0]; llz.lat = c[1];
    }
    return llz;
}

// ═══════════════════════════════════════════════════════════════
// Coordinate conversion: WGS84 → target map's system/zoom
// ═══════════════════════════════════════════════════════════════

// 2GIS city slug lookup table
const CITIES_2GIS = [
    {c:'moscow',       lon0:36.763,lat0:56.108,lon1:38.221,lat1:55.105},
    {c:'spb',          lon0:29.413,lat0:60.292,lon1:31.025,lat1:59.536},
    {c:'kyiv',         lon0:30.046,lat0:50.653,lon1:30.680,lat1:50.148},
    {c:'novosibirsk',  lon0:82.511,lat0:55.248,lon1:83.392,lat1:54.554},
    {c:'ekaterinburg', lon0:60.237,lat0:57.035,lon1:60.939,lat1:56.600},
    {c:'kazan',        lon0:48.295,lat0:55.997,lon1:49.531,lat1:55.568},
    {c:'n_novgorod',   lon0:43.301,lat0:56.476,lon1:44.251,lat1:56.074},
    {c:'chelyabinsk',  lon0:61.190,lat0:55.318,lon1:61.740,lat1:54.992},
    {c:'samara',       lon0:49.780,lat0:53.712,lon1:50.522,lat1:53.040},
    {c:'omsk',         lon0:72.888,lat0:55.416,lon1:73.768,lat1:54.787},
    {c:'rostov',       lon0:39.359,lat0:47.367,lon1:39.922,lat1:47.054},
    {c:'ufa',          lon0:55.714,lat0:54.923,lon1:56.311,lat1:54.479},
    {c:'volgograd',    lon0:43.973,lat0:48.926,lon1:44.928,lat1:48.315},
    {c:'perm',         lon0:55.615,lat0:58.243,lon1:56.658,lat1:57.687},
    {c:'krasnodar',    lon0:38.653,lat0:45.264,lon1:39.376,lat1:44.945},
    {c:'voronezh',     lon0:38.990,lat0:51.911,lon1:39.612,lat1:51.476},
    {c:'krasnoyarsk',  lon0:92.131,lat0:56.307,lon1:93.595,lat1:55.813},
    {c:'khabarovsk',   lon0:134.878,lat0:48.605,lon1:135.255,lat1:48.290},
    {c:'vladivostok',  lon0:131.563,lat0:43.614,lon1:132.340,lat1:42.805},
    {c:'almaty',       lon0:76.720,lat0:43.467,lon1:77.104,lat1:43.110},
    {c:'astana',       lon0:71.122,lat0:51.372,lon1:71.837,lat1:50.934},
    {c:'sochi',        lon0:38.939,lat0:44.354,lon1:40.486,lat1:43.364},
    {c:'novorossiysk', lon0:36.942,lat0:45.221,lon1:38.668,lat1:44.308},
];

function convertWME2Other(id, llz) {
    // LiveMap uses zoom − 1
    if (id === '_map_LI') llz.zoom = Math.max(0, llz.zoom - 1);

    switch (id) {

        case '_map_2GIS': {
            if (llz.zoom > 18) llz.zoom = 18;
            for (const city of CITIES_2GIS) {
                if (llz.lon >= city.lon0 && llz.lon <= city.lon1 &&
                    llz.lat >= city.lat1 && llz.lat <= city.lat0) {
                    llz.city = city.c; break;
                }
            }
            break;
        }

        case '_map_BM': {
            // Baltic Maps encodes position as EPSG:3857 in the URL path
            const c = proj4('EPSG:4326', 'EPSG:3857', [llz.lon, llz.lat]);
            llz.lon = c[0]; llz.lat = c[1];
            break;
        }

        case '_map_WMFLAB': {
            const deg2dms = d => {
                const deg = Math.trunc(d);
                const min = Math.trunc((d - deg) * 60);
                const sec = Math.round(((d - deg) * 60 - min) * 60 * 10) / 10;
                return `${deg}_${min}_${sec}`;
            };
            llz.lat  = deg2dms(llz.lat);
            llz.lon  = deg2dms(llz.lon);
            llz.zoom = Math.pow(2, 12 - llz.zoom) * 100000;
            break;
        }

        case '_map_AMR':
            llz.zoom = llz.zoom >= 7 ? 10 : llz.zoom + 4;
            break;

        case '_map_MRY':
            llz.zoom = Math.max(0, llz.zoom - 1);
            break;

        case '_map_KVIEW':
            if (llz.zoom > 18) llz.zoom = 18;
            break;

        default: break;
    }

    log('convertWME2Other()', id, llz);
    return llz;
}

// ═══════════════════════════════════════════════════════════════
// Open a target map
// ═══════════════════════════════════════════════════════════════
function jumpToMap(mapId) {
    log('jumpToMap()', mapId);

    let llz = getLLZ();
    const goingToWME = mapId === '_map_WME' || mapId === '_map_WMEB';

    if (goingToWME) {
        llz = convertOther2WME(llz);
    } else {
        llz = convertWME2Other(mapId, llz);
    }

    const def = mapDefs[mapId];
    if (!def) { console.warn('[WME-JM] No definition for', mapId); return; }

    let url = def.template
        .replace('{{city}}', llz.city || '')
        .replace('{{lon}}',  llz.lon)
        .replace('{{lat}}',  llz.lat)
        .replace('{{zoom}}', llz.zoom);

    if (goingToWME) url += '&marker=yes';

    log('Opening:', url);
    window.open(url, `_jm_${mapId}`);
}

// ═══════════════════════════════════════════════════════════════
// Alpha ↔ Beta editor switcher
// ═══════════════════════════════════════════════════════════════
function getSwitcherHref() {
    const center = sdk.Map.getMapCenter();
    const zoom   = sdk.Map.getZoomLevel();
    const base   = location.hostname === 'www.waze.com'
        ? 'https://beta.waze.com/editor'
        : 'https://www.waze.com/editor';
    return `${base}/?env=row&zoomLevel=${zoom}&lat=${center.lat}&lon=${center.lon}&marker=yes`;
}

// ═══════════════════════════════════════════════════════════════
// localStorage helpers
// ═══════════════════════════════════════════════════════════════
function serializeLinks() {
    const out = {};
    for (const [id, def] of Object.entries(mapDefs)) {
        if (def.save === 1) out[id] = def;
    }
    return JSON.stringify(out);
}

function loadMapDefs() {
    mapDefs = deepClone(DEFAULT_MAPS);
    const raw = localStorage.getItem(LS.LINK);
    if (!raw || !isJson(raw)) return;
    const saved = JSON.parse(raw);
    for (const id of Object.keys(mapDefs)) {
        if (saved[id]) {
            mapDefs[id].save     = 1;
            mapDefs[id].name     = saved[id].name     ?? mapDefs[id].name;
            mapDefs[id].title    = saved[id].title    ?? mapDefs[id].title;
            mapDefs[id].template = saved[id].template ?? mapDefs[id].template;
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// Floating toolbar (WME only)
// ═══════════════════════════════════════════════════════════════
function buildFloatBar() {
    let bar = document.getElementById(FLOAT_ID);

    if (!bar) {
        bar = document.createElement('div');
        bar.id = FLOAT_ID;
        bar.style.cssText = [
            'position:absolute',
            `top:${cfg.topOffset}`,
            `left:${cfg.leftOffset}`,
            'z-index:9999',
            'background:#eeeeee',
            'border:1px solid #aaa',
            'border-radius:4px',
            'padding:3px 7px',
            'font-size:11px',
            'line-height:20px',
            'cursor:default',
            'user-select:none',
            `visibility:${cfg.hideWindow ? 'hidden' : 'visible'}`,
        ].join(';');

        (document.getElementById('waze-map-container')?.parentElement ?? document.body)
            .appendChild(bar);

        makeDraggable(bar);
    }

    // ── Rebuild inner HTML ───────────────────────────────────
    let html = `<b>JM&nbsp;${SCRIPT_VERSION}</b>&nbsp;`;

    for (const [id, def] of Object.entries(mapDefs)) {
        if (['_map_WME','_map_WMEB','_map_LI'].includes(id)) continue;
        if (!def.save) continue;
        html += `<a data-jmid="${id}" title="${def.title}" `
              + `style="cursor:pointer;text-decoration:none;color:#00547a">${def.name}</a>&nbsp;`;
    }

    // [Live] always visible
    html += `<a data-jmid="_map_LI" title="Open in LiveMap" `
          + `style="cursor:pointer;text-decoration:none;color:#00547a">[Live]</a>&nbsp;`;

    // α / β switcher
    const isMain = location.hostname === 'www.waze.com';
    html += `<a id="wmejm-sw" title="${isMain ? 'Open in Beta' : 'Open in Main'} editor" `
          + `style="cursor:pointer;text-decoration:none;color:#00547a;font-size:13px">`
          + `[${isMain ? '&#946;' : '&#945;'}]</a>`;

    bar.innerHTML = html;

    // Click handlers
    bar.querySelectorAll('[data-jmid]').forEach(a => {
        a.addEventListener('click', e => { e.preventDefault(); jumpToMap(a.dataset.jmid); });
    });
    document.getElementById('wmejm-sw')?.addEventListener('click', e => {
        e.preventDefault();
        window.open(getSwitcherHref(), '_jm_switcher');
    });
}

// ═══════════════════════════════════════════════════════════════
// Draggable float bar
// ═══════════════════════════════════════════════════════════════
function makeDraggable(el) {
    let drag = false, startX = 0, startY = 0, origLeft = 0, origTop = 0;

    el.addEventListener('mousedown', e => {
        if (e.target.tagName === 'A') return; // don't hijack link clicks
        drag     = true;
        startX   = e.clientX; startY = e.clientY;
        origLeft = parseInt(el.style.left) || 0;
        origTop  = parseInt(el.style.top)  || 0;
    });
    window.addEventListener('mouseup', () => {
        if (drag) {
            localStorage.setItem(LS.LEFT, el.style.left);
            localStorage.setItem(LS.TOP,  el.style.top);
        }
        drag = false;
    });
    window.addEventListener('mousemove', e => {
        if (!drag) return;
        el.style.left = (origLeft + e.clientX - startX) + 'px';
        el.style.top  = (origTop  + e.clientY - startY) + 'px';
        e.preventDefault();
    });
}

// ═══════════════════════════════════════════════════════════════
// Settings panel
// ═══════════════════════════════════════════════════════════════

/**
 * Register a sidebar tab via sdk.Sidebar.registerScriptTab().
 * If that fails, fall back to a floating ⚙ panel.
 *
 * SDK docs:
 *   sdk.Sidebar.registerScriptTab() → Promise<{ tabLabel, tabPane }>
 */
async function buildSettingsPanel() {
    let tabLabel, tabPane;
    try {
        const result = await sdk.Sidebar.registerScriptTab();
        tabLabel = result.tabLabel;
        tabPane  = result.tabPane;
    } catch (e) {
        console.warn('[WME-JM] Sidebar.registerScriptTab() failed — using floating panel fallback:', e);
        buildFloatingSettingsFallback();
        return;
    }

    tabLabel.innerText = 'JM';
    tabLabel.title     = `WME JumpMaps ${SCRIPT_VERSION}`;
    tabPane.appendChild(createSettingsDOM());
}

/** Build the settings DOM (used by both sidebar tab and floating fallback) */
function createSettingsDOM() {
    const root = document.createElement('div');
    root.style.cssText = 'padding:8px;font-family:sans-serif;font-size:12px';
    root.innerHTML = `<h4 style="margin:0 0 6px">WME JumpMaps <sup>${SCRIPT_VERSION}</sup></h4>`
                   + `<hr style="margin:4px 0">`;

    // ── Destinations ────────────────────────────────────────
    const hdr = document.createElement('b');
    hdr.textContent = 'Destinations:';
    root.appendChild(hdr);

    for (const [id, def] of Object.entries(mapDefs)) {
        if (['_map_WME','_map_WMEB','_map_LI'].includes(id)) continue;

        const row = document.createElement('div');
        row.style.margin = '3px 0';

        // Visibility checkbox
        const chk = document.createElement('input');
        chk.type    = 'checkbox';
        chk.checked = !!def.save;
        chk.style.marginRight = '4px';
        chk.addEventListener('change', () => {
            mapDefs[id].save = chk.checked ? 1 : 0;
            localStorage.setItem(LS.LINK, serializeLinks());
            buildFloatBar();
        });

        const lbl = document.createElement('label');
        lbl.style.cursor = 'pointer';
        lbl.appendChild(chk);
        lbl.appendChild(document.createTextNode(def.title));

        // [edit] toggle
        const editBtn = document.createElement('a');
        editBtn.href        = '#';
        editBtn.textContent = ' [edit]';
        editBtn.style.cssText = 'font-size:10px;margin-left:4px';

        const editArea = document.createElement('div');
        editArea.style.cssText = 'display:none;padding:2px 0 2px 14px;font-size:11px';

        const fields = [
            { label:'Name',     key:'name',     size:12 },
            { label:'Title',    key:'title',    size:24 },
            { label:'Template', key:'template', size:36, title:'Placeholders: {{city}} {{lon}} {{lat}} {{zoom}}' },
        ];
        fields.forEach(f => {
            const inp = document.createElement('input');
            inp.value = def[f.key];
            inp.size  = f.size;
            if (f.title) inp.title = f.title;
            inp.style.marginLeft = '4px';
            inp.addEventListener('change', () => {
                mapDefs[id][f.key] = inp.value;
                localStorage.setItem(LS.LINK, serializeLinks());
                buildFloatBar();
            });
            const line = document.createElement('div');
            line.textContent = f.label + ':';
            line.appendChild(inp);
            editArea.appendChild(line);
        });

        editBtn.addEventListener('click', e => {
            e.preventDefault();
            editArea.style.display = editArea.style.display === 'none' ? 'block' : 'none';
        });

        row.appendChild(lbl);
        row.appendChild(editBtn);
        row.appendChild(editArea);
        root.appendChild(row);
    }

    // ── Options ─────────────────────────────────────────────
    root.appendChild(Object.assign(document.createElement('hr'), { style:'margin:6px 0' }));
    const optHdr = document.createElement('b');
    optHdr.textContent = 'Options:';
    root.appendChild(optHdr);

    function addOpt(text, lsKey, prop, extraHandler) {
        const wrap = document.createElement('div');
        const c    = document.createElement('input');
        c.type    = 'checkbox';
        c.checked = cfg[prop];
        c.style.marginRight = '4px';
        c.addEventListener('change', () => {
            cfg[prop] = c.checked;
            localStorage.setItem(lsKey, c.checked ? '1' : '0');
            if (extraHandler) extraHandler(c.checked);
        });
        const l = document.createElement('label');
        l.appendChild(c);
        l.appendChild(document.createTextNode(text));
        wrap.appendChild(l);
        root.appendChild(wrap);
    }

    addOpt('Restore selected after jump', LS.RESTORE, 'restoreSelected');
    addOpt('Debug log',                   LS.DEBUG,   'debug');
    addOpt('Hide floating bar',           LS.HIDE,    'hideWindow', v => {
        const bar = document.getElementById(FLOAT_ID);
        if (bar) bar.style.visibility = v ? 'hidden' : 'visible';
    });

    function addBtn(text, title, onClick) {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.title = title;
        btn.style.cssText = 'display:block;margin-top:5px;font-size:11px;cursor:pointer';
        btn.addEventListener('click', onClick);
        root.appendChild(btn);
    }

    addBtn('↺ Reset config', 'Reset all JumpMaps settings to defaults', () => {
        if (!confirm('Reset WME JumpMaps config?')) return;
        localStorage.removeItem(LS.LINK);
        localStorage.removeItem(LS.DEBUG);
        cfg.debug = false;
        loadMapDefs();
        buildFloatBar();
        // Refresh form in-place
        while (root.firstChild) root.removeChild(root.firstChild);
        root.appendChild(createSettingsDOM());
    });

    addBtn('↺ Reset bar position', 'Move floating bar back to default position', () => {
        localStorage.setItem(LS.LEFT, DEFAULT_LEFT);
        localStorage.setItem(LS.TOP,  DEFAULT_TOP);
        const bar = document.getElementById(FLOAT_ID);
        if (bar) { bar.style.left = DEFAULT_LEFT; bar.style.top = DEFAULT_TOP; }
    });

    return root;
}

/** Floating settings panel — fallback when Sidebar API is unavailable */
function buildFloatingSettingsFallback() {
    const panel = document.createElement('div');
    panel.id = 'wmejm-settings-panel';
    panel.style.cssText = [
        'position:absolute',
        `top:${parseInt(cfg.topOffset) + 30}px`,
        `left:${cfg.leftOffset}`,
        'z-index:10000',
        'background:#fff',
        'border:1px solid #aaa',
        'border-radius:4px',
        'box-shadow:0 3px 10px rgba(0,0,0,.3)',
        'display:none',
        'max-height:80vh',
        'overflow-y:auto',
        'min-width:320px',
    ].join(';');
    panel.appendChild(createSettingsDOM());

    (document.getElementById('waze-map-container')?.parentElement ?? document.body)
        .appendChild(panel);

    // Add ⚙ toggle button to the floating bar
    const bar = document.getElementById(FLOAT_ID);
    if (bar) {
        const btn = document.createElement('a');
        btn.textContent = ' ⚙';
        btn.title = 'JumpMaps settings';
        btn.style.cssText = 'cursor:pointer;color:#00547a;text-decoration:none';
        btn.addEventListener('click', e => {
            e.preventDefault();
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        });
        bar.appendChild(btn);
    }
}

// ═══════════════════════════════════════════════════════════════
// External map sites: insert a "jump to WME" icon button
// ═══════════════════════════════════════════════════════════════
// Waze icon (DiemenDesign/LibreICONS, MIT) — light grey rounded rect + dark grey border + black logo.
// base64 SVG data URI: no external requests, CSP-safe.
const WME_ICON_SVG = '<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgdmlld0JveD0iMCAwIDMyIDMyIj48cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHJ4PSI2IiByeT0iNiIgZmlsbD0iI2YwZjBmMCIgc3Ryb2tlPSIjNjY2NjY2IiBzdHJva2Utd2lkdGg9IjEuMiIvPjxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDIuMywyLjMpIHNjYWxlKDEuOTY0KSI+PHBhdGggZmlsbD0iIzAwMCIgZD0ibSAxMi45Mzc2NDksNS42ODk2ODUgYyAtMC4xMTYyNSwtMC42ODY2MSAtMC4zODg5MTQsLTEuMzMwMTYgLTAuODEwNjM4LC0xLjkxMjgyIC0wLjQ3NjMxNCwtMC42NTgxMSAtMS4xMjc5MjIsLTEuMjA3NjEgLTEuODg0MzI0LC0xLjU4OTAzIC0wLjc2NDUzMzksLTAuMzg1NTIgLTEuNjE3ODgyOSwtMC41ODkzOCAtMi40Njc4MzY5LC0wLjU4OTM4IC0wLjIzOTc4MywwIC0wLjQ4MTQ3NSwwLjAxNjMgLTAuNzE4NDMsMC4wNDgyIC0wLjk5MjM2NywwLjEzNDA3IC0xLjk2ODExOCwwLjU0Njg5IC0yLjc0NzU3MiwxLjE2MjQzIC0wLjg3ODIzOSwwLjY5MzU0IC0xLjQ0NDk5MywxLjU4NTIxIC0xLjYzODg4NCwyLjU3ODc4IC0wLjA1Nzc3LDAuMjk1MzcgLTAuMDgyMzgsMC42MjIxMiAtMC4xMDYyMDksMC45MzgwNiAtMC4wMzczNCwwLjQ5NDU2IC0wLjA3NTk0LDEuMDA1OTUgLTAuMjMzMjA3LDEuMzQwMTMgLTAuMTA3NDgyLDAuMjI4NCAtMC4yNjc4NTYsMC4zODA1IC0wLjcwMTM4OSwwLjM4MDUgLTAuMjM4NTgxLDAgLTAuNDU2NTg1LDAuMTM0OTIgLTAuNTYzMDc3LDAuMzQ4NDcgLTAuMTA2NDIwOTgsMC4yMTM1NSAtMC4wODI5NCwwLjQ2ODg5IDAuMDYwNiwwLjY1OTMxIDAuNjUzMTY0LDAuODY2NSAxLjUwNTUyMiwxLjM5MTMzIDIuNDAyOTIzLDEuNzA3NTUgLTAuMDQwODcsMC4xMjM0NiAtMC4wNjM4NSwwLjI1NDkxIC0wLjA2Mzg1LDAuMzkyMDkgMCwwLjY4OTAyIDAuNTU4NTUxLDEuMjQ3NTcgMS4yNDc1NjYsMS4yNDc1NyAwLjY3MTk3MiwwIDEuMjE4MjkxLC0wLjUzMTYxIDEuMjQ0OTQ5LC0xLjE5NzAxIDAuMjkyNTM0LDAuMDE1OSAxLjY4NTQ4MywwLjAxOTcgMS44NDA4MzYsMC4wMTUzIDAuMDM0NDQsMC42NTgyNSAwLjU3NzUwMiwxLjE4MTY2IDEuMjQ0MjQzLDEuMTgxNjYgMC42ODg5NDMsMCAxLjI0NzQ5NDksLTAuNTU4NDggMS4yNDc0OTQ5LC0xLjI0NzU3IDAsLTAuMTU3MDUgLTAuMDMwMjYsLTAuMzA2NzQgLTAuMDgzMTYsLTAuNDQ1MTMgMC40ODkxODMsLTAuMjM3OTQgMC45NTA5MywtMC41NTkwNCAxLjM1Mzg0NSwtMC45NDU3NiAwLjU2MTg3NSwtMC41MzkxOCAwLjk3NDI2NSwtMS4xNzUzIDEuMTkyNzY0LC0xLjgzOTY0IDAuMjQ1ODY1LC0wLjc0NzcgMC4zMDc2NjcsLTEuNDk5MyAwLjE4MzM1NSwtMi4yMzM3OCBtIC04LjIyNDMyOTksNS44NzYgYyAtMC4yMjczMzgsMCAtMC40MTE2ODQsLTAuMTg0MjEgLTAuNDExNjg0LC0wLjQxMTY5IDAsLTAuMjI3MzMgMC4xODQzNDYsLTAuNDExNjggMC40MTE2ODQsLTAuNDExNjggMC4yMjc0MDgsMCAwLjQxMTY4MywwLjE4NDM1IDAuNDExNjgzLDAuNDExNjggMCwwLjIyNzQ4IC0wLjE4NDI3NSwwLjQxMTY5IC0wLjQxMTY4MywwLjQxMTY5IG0gNC4zMzAwMjgsMCBjIC0wLjIyNzQwOSwwIC0wLjQxMTc1NCwtMC4xODQyMSAtMC40MTE3NTQsLTAuNDExNjkgMCwtMC4yMjczMyAwLjE4NDM0NSwtMC40MTE2OCAwLjQxMTc1NCwtMC40MTE2OCAwLjIyNzQwOCwwIDAuNDExNjgzLDAuMTg0MzUgMC40MTE2ODMsMC40MTE2OCA3LjFlLTUsMC4yMjc0OCAtMC4xODQyNzUsMC40MTE2OSAtMC40MTE2ODMsMC40MTE2OSBtIDMuMTEzMjkxOSwtMy44Mzg3MyBjIC0wLjM2MDI3NiwxLjA5NTMzIC0xLjMwOTg2MiwxLjk5OTggLTIuMzIxODE2OSwyLjQ2Mjg5IC0wLjIxNTQ1OCwtMC4xNzcwNiAtMC40OTA5NTEsLTAuMjgzMjcgLTAuNzkxNDA1LC0wLjI4MzI3IC0wLjQ4NDIzMywwIC0wLjkwMzA1OCwwLjI3NjIgLTEuMTA5NzQ4LDAuNjc5MzMgLTAuMjEwNDM4LDAuMDA5IC0xLjc3NzMzOCwwLjAwMyAtMi4xMjAyMTksLTAuMDIwMiAtMC4yMTAxNTUsLTAuMzkyMjMgLTAuNjIzODE4LC0wLjY1OTE3IC0xLjEwMDA2MSwtMC42NTkxNyAtMC4zMTY3ODgsMCAtMC42MDUyMjEsMC4xMTg5NCAtMC44MjUxMzQsMC4zMTM1NCAtMC44NTIzNTgsLTAuMjc1NDMgLTEuNjU3MzQsLTAuNzQ2MDggLTIuMjU5MDI1LC0xLjU0NDQ5IDEuNzc5MTc2LDAgMS40MjgwOTIsLTEuOTg4MjcgMS42NTgyNTksLTMuMTY3MzEgMC4zNTA2NTksLTEuNzk2OTMgMi4xMjgzNSwtMy4wMDUxOCAzLjg1MzE0OCwtMy4yMzgxNyAwLjIxMjEzNSwtMC4wMjg2IDAuNDI0MjcsLTAuMDQyNiAwLjYzNDIxMywtMC4wNDI2IDIuODM0NzU5OSw3ZS01IDUuMzU4MTA0OSwyLjUzMDk4IDQuMzgxNzg4OSw1LjQ5OTM4IG0gLTQuNDA1NjE4OSwwLjg3NDM1IGMgLTEuMDIzNjkyLDAgLTEuOTQ1OTE0LC0wLjY3MTE5IC0yLjExNTA1NiwtMS41NDk3OCAtMC4wMzI4MSwtMC4xNzA1NiAwLjA3ODkxLC0wLjMzNTUzIDAuMjQ5NDcxLC0wLjM2ODM0IDAuMTcwNjI3LC0wLjAzMjkgMC4zMzU1MjcsMC4wNzg5IDAuMzY4MzM3LDAuMjQ5NDcgMC4wOTk0MiwwLjUxNjQ4IDAuNzE3ODY1LDEuMDYwMzkgMS41NDIyMjEsMS4wMzg4MiAwLjg1ODcyMiwtMC4wMjI1IDEuNDI1OSwtMC41MzU5OSAxLjU0MjQzMywtMS4wMzE1NCAwLjAzOTgxLC0wLjE2OTA3IDAuMjA5Mzc4LC0wLjI3Mzc5IDAuMzc4MzA4LC0wLjIzNDE5IDAuMTY5MjEzLDAuMDM5OCAwLjI3NDAwNywwLjIwOTE2IDAuMjM0MTk3LDAuMzc4MjMgLTAuMDk1MTgsMC40MDQ1NCAtMC4zNTU2OCwwLjc3OTMyIC0wLjczMzYzNCwxLjA1NTQ1IC0wLjM5MzY1MiwwLjI4Nzc5IC0wLjg3OTUxMSwwLjQ0NzE4IC0xLjQwNDc1NywwLjQ2MTA0IC0wLjAyMDUxLDYuM2UtNCAtMC4wNDEwOCw4LjRlLTQgLTAuMDYxNTIsOC40ZS00IG0gMi4wMzcxMzIsLTMuMjM5NTggYyAwLDAuMzMzNjkgLTAuMjcwNTQyLDAuNjA0MjMgLTAuNjA0MjMxLDAuNjA0MjMgLTAuMzMzNjE3LDAgLTAuNjA0MTYsLTAuMjcwNTQgLTAuNjA0MTYsLTAuNjA0MjMgMCwtMC4zMzM2OSAwLjI3MDU0MywtMC42MDQwOSAwLjYwNDE2LC0wLjYwNDA5IDAuMzMzNjg5LDAgMC42MDQyMzEsMC4yNzAzMyAwLjYwNDIzMSwwLjYwNDA5IG0gLTIuODIyNTk3LDAgYyAwLDAuMzMzNjkgLTAuMjcwNDcyLDAuNjA0MjMgLTAuNjA0MTYsMC42MDQyMyAtMC4zMzM2MTgsMCAtMC42MDQxNiwtMC4yNzA1NCAtMC42MDQxNiwtMC42MDQyMyAwLC0wLjMzMzY5IDAuMjcwNTQyLC0wLjYwNDA5IDAuNjA0MTYsLTAuNjA0MDkgMC4zMzM2ODgsMCAwLjYwNDE2LDAuMjcwMzMgMC42MDQxNiwwLjYwNDA5Ii8+PC9nPjwvc3ZnPg==" width="32" height="32" alt="WME" style="display:block">';

const INJECT_MAP = {
    NM      : { how:'class', sel:'nk-app-bar-view__button_id_help', insert:'append-parent' },
    YM      : { how:'class', sel:'map-controls-view__zoom-control',  insert:'before-parent' },
    google  : { how:'class', sel:'TorxFf',                           insert:'prepend' },
    '2gis'  : { how:'id',    sel:'root',                             insert:'prepend' },
    re      : { how:'class', sel:'zoom-buttons-container',           insert:'append' },
    sco     : { how:'class', sel:'map-layer-top',                    insert:'before' },
    wm      : { how:'id',    sel:'wm-Add',                           insert:'append' },
    bm      : { how:'id',    sel:'map_mb',                           insert:'append' },
    osm     : { how:'class', sel:'leaflet-top leaflet-right',        insert:'prepend' },
    kadua   : { how:'class', sel:'interfaceGuide',                   insert:'after' },
    mry     : { how:'class', sel:'comments',                         insert:'before-parent' },
    mapilio : { how:'class', sel:'MuiBox-root css-i8np4w',           insert:'before' },
    kview   : { how:'class', sel:'map-container mapboxgl-map',       insert:'before' },
    sc      : { how:'id',    sel:'map_right_menu',                   insert:'append' },
    bing    : { how:'class', sel:'map-footer',                       insert:'prepend' },
    here    : { how:'class', sel:'tpoi-container',                   insert:'prepend' },
    apple   : { how:'class', sel:'maps-canvas-container',            insert:'prepend' },
    vcua    : { how:'id',    sel:'map',                              insert:'prepend' },
    spro    : { how:'id',    sel:'map',                              insert:'prepend' },
};

// Sites that use a floating fixed button (unstable DOM / SPA)
const FLOATING_ICON_SITES = new Set(['bing', 'here', 'apple', 'vcua', 'spro']);

// localStorage keys for floating icon position per site
function extIconLsKey(loc) { return `WMEJumpMapsExtIcon_${loc}`; }

/** Create a draggable fixed WME button for SPA/unstable-DOM sites */
function insertFloatingIcon(loc) {
    if (document.getElementById('wmejm-ext-btn')) return;

    // Restore saved position or default to bottom-right
    let savedPos = null;
    try { savedPos = JSON.parse(localStorage.getItem(extIconLsKey(loc))); } catch {}
    const initRight  = (savedPos && savedPos.right  != null) ? savedPos.right  + 'px' : '16px';
    const initBottom = (savedPos && savedPos.bottom != null) ? savedPos.bottom + 'px' : '80px';

    const btn = document.createElement('div');
    btn.id = 'wmejm-ext-btn';
    btn.innerHTML = WME_ICON_SVG;
    btn.title = 'Open in WME';
    btn.style.cssText = [
        'position:fixed',
        `right:${initRight}`,
        `bottom:${initBottom}`,
        'z-index:2147483647',
        'cursor:pointer',
        'user-select:none',
        'border-radius:6px',
        'box-shadow:0 2px 6px rgba(0,0,0,.35)',
        'transition:box-shadow .15s',
    ].join(';');

    // Drag logic (right/bottom anchored so it stays in corner after resize)
    let dragging = false, startX, startY, startRight, startBottom;

    btn.addEventListener('mousedown', e => {
        dragging = true;
        startX = e.clientX; startY = e.clientY;
        startRight  = parseInt(btn.style.right)  || 16;
        startBottom = parseInt(btn.style.bottom) || 80;
        btn.style.boxShadow = '0 4px 12px rgba(0,0,0,.5)';
        btn.style.transition = 'none';
        e.preventDefault();
    });

    window.addEventListener('mousemove', e => {
        if (!dragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        btn.style.right  = Math.max(0, startRight  - dx) + 'px';
        btn.style.bottom = Math.max(0, startBottom - dy) + 'px';
    });

    window.addEventListener('mouseup', e => {
        if (!dragging) return;
        dragging = false;
        btn.style.boxShadow = '0 2px 6px rgba(0,0,0,.35)';
        btn.style.transition = 'box-shadow .15s';
        // Save position
        const pos = {
            right:  parseInt(btn.style.right),
            bottom: parseInt(btn.style.bottom),
        };
        localStorage.setItem(extIconLsKey(loc), JSON.stringify(pos));
    });

    // Click → open WME (only when not dragging)
    let moved = false;
    btn.addEventListener('mousedown', () => { moved = false; });
    window.addEventListener('mousemove', () => { if (dragging) moved = true; });
    btn.addEventListener('mouseup', () => {
        if (moved) return;
        let llz = getLLZ();
        llz = convertOther2WME(llz);
        const url = DEFAULT_MAPS._map_WME.template
            .replace('{{zoom}}', llz.zoom)
            .replace('{{lat}}',  llz.lat)
            .replace('{{lon}}',  llz.lon) + '&marker=yes';
        window.open(url, '_jm_wme');
    });

    document.body.appendChild(btn);
}

/** Insert WME icon button on external map sites */
let extInsertTries = 0;

function insertExternalIcon() {
    if (document.getElementById('wmejm-ext-btn')) return;

    const loc = getLocationType();
    if (!loc || loc === 'waze') return;

    // SPA / unstable-DOM sites → floating fixed button
    if (FLOATING_ICON_SITES.has(loc)) {
        if (document.body) {
            insertFloatingIcon(loc);
        } else {
            document.addEventListener('DOMContentLoaded', () => insertFloatingIcon(loc));
        }
        return;
    }

    // All other sites → anchor-based injection
    const inj = INJECT_MAP[loc];
    if (!inj) return;

    let anchor;
    if (inj.how === 'id')    anchor = document.getElementById(inj.sel);
    if (inj.how === 'class') anchor = document.getElementsByClassName(inj.sel)[0];
    if (inj.how === 'tag')   anchor = document.getElementsByTagName(inj.sel)[0];

    if (!anchor) {
        if (++extInsertTries < 10) setTimeout(insertExternalIcon, 800);
        return;
    }

    const btn = document.createElement('div');
    btn.id = 'wmejm-ext-btn';
    btn.title = 'Open in WME';
    btn.style.cssText = 'cursor:pointer;z-index:9999;display:block;pointer-events:auto;margin:5px';
    btn.innerHTML = WME_ICON_SVG;

    btn.addEventListener('click', () => {
        let llz = getLLZ();
        llz = convertOther2WME(llz);
        const url = DEFAULT_MAPS._map_WME.template
            .replace('{{zoom}}', llz.zoom)
            .replace('{{lat}}',  llz.lat)
            .replace('{{lon}}',  llz.lon) + '&marker=yes';
        window.open(url, '_jm_wme');
    });

    switch (inj.insert) {
        case 'append':        anchor.appendChild(btn); break;
        case 'prepend':       anchor.insertBefore(btn, anchor.firstChild); break;
        case 'before':        anchor.parentElement?.insertBefore(btn, anchor); break;
        case 'after':         anchor.parentElement?.insertBefore(btn, anchor.nextSibling); break;
        case 'before-parent': anchor.parentElement?.parentElement?.insertBefore(btn, anchor.parentElement); break;
        case 'append-parent': anchor.parentElement?.appendChild(btn); break;
    }
}

// ═══════════════════════════════════════════════════════════════
// WME initialisation
// ═══════════════════════════════════════════════════════════════
function initWME() {
    if (typeof getWmeSdk === 'undefined') {
        console.warn('[WME-JM] getWmeSdk not found — not running inside WME?');
        return;
    }

    // Initialise the SDK instance for this script
    // See: https://www.waze.com/editor/sdk/index.html
    sdk = getWmeSdk({ scriptId: SCRIPT_ID, scriptName: SCRIPT_NAME });

    // 'wme-ready' fires exactly once: after wme-initialized + wme-logged-in + wme-map-initial-data-loaded
    sdk.Events.once({ eventName: 'wme-ready' }).then(() => {
        console.log(`[WME-JM ${SCRIPT_VERSION}] wme-ready received — starting`);
        loadMapDefs();
        buildFloatBar();
        buildSettingsPanel(); // async — uses sdk.Sidebar.registerScriptTab()
    });
}

// ═══════════════════════════════════════════════════════════════
// Entry point
// ═══════════════════════════════════════════════════════════════
(function bootstrap() {
    console.log(`[WME-JM ${SCRIPT_VERSION}] bootstrap @ ${location.hostname}`);

    cfg.debug           = lsGet(LS.DEBUG,   'bool', false);
    cfg.restoreSelected = lsGet(LS.RESTORE, 'bool', false);
    cfg.hideWindow      = lsGet(LS.HIDE,    'bool', false);
    cfg.topOffset       = lsGet(LS.TOP,     'str',  DEFAULT_TOP);
    cfg.leftOffset      = lsGet(LS.LEFT,    'str',  DEFAULT_LEFT);

    const loc = getLocationType();

    if (loc === 'waze') {
        // SDK_INITIALIZED is a Promise that WME resolves as soon as getWmeSdk() is available
        if (typeof SDK_INITIALIZED !== 'undefined') {
            SDK_INITIALIZED.then(initWME);
        } else {
            // Defensive fallback for very old WME builds
            window.addEventListener('load', initWME);
        }
    } else if (loc) {
        const delay = (loc === 'YM') ? 3000 : 500;
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => setTimeout(insertExternalIcon, delay));
        } else {
            setTimeout(insertExternalIcon, delay);
        }
    }
})();