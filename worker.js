self.addEventListener('install', ev => {
    self.skipWaiting();
    ev.waitUntil(caches.open('BBX').then(cache => {
        cache.addAll(List.essential);
        cache.put(Head.url, new Response(Head.code));
        console.log('updated');
    }));
});
self.addEventListener('activate', ev => ev.waitUntil(clients.claim()));
self.addEventListener('fetch', ev => ev.respondWith(
    (async () => {
        let {url} = ev.request;
        if (/\/sw\/update/.test(url))
            return updateFiles(true);

        //Promise.resolve(self.cached ?? Head.fetch().then(html => self.cached = parseInt(html.match(/content=(\d+)/)?.[1] ?? 0)))
        //.then(() => new Date / 1000 > self.cached + 60*60*24*14 && updateFiles()) //14 days
        //.then(() => caches.match(url, {ignoreSearch: true}))
        //.then(cached => cached || goFetch(url))
        return /woff2$/.test(url) ? fetch(ev.request) : goFetch(url).then(Head.add).catch(er => console.error(er));
    })()
));
const updateFiles = resp => 
    caches.open('BBX').then(cache => Promise.all(
        List.periodic.map(url => fetch(`${url}${/css|js|json$/.test(url) ? `?${Math.random()}` : ''}`).then(resp => cache.add(url, resp)))
    ))
    .then(() => resp ? new Response('', {status: 200}) : true)
    .catch(er => console.error(er), resp ? new Response('', {status: 400}) : false);


const is = {
    internal: url => 'go-shoot.github.io' == new URL(url).host,
    parts: url => /img\/.+?\/.+?\.png$/.test(url),
    cacheable: url => /tier\.json$/.test(new URL(url).pathname) || !/\.json$/.test(new URL(url).pathname),
}
const goFetch = url =>
    fetch(new Request(`${url}${/css|js|json$/.test(url) ? `?${Math.random()}` : ''}`, {mode: 'no-cors'})).then(async resp => {
        //if (resp.status == 200 && is.internal(url) && is.cacheable(url))
        //    (await caches.open(is.parts(url) ? 'parts' : 'BBX')).add(url.replace(/[?#].*$/, ''), resp.clone());
        return resp;
    });
    
const Head = {
    url: '/include/head.html',
    code: `
    <meta charset=UTF-8>
    <meta name=viewport content='width=device-width,initial-scale=1'>
    <meta name=theme-color content='#b0ff50'>
    <link rel=stylesheet href=/include/common.css>
    <link rel=apple-touch-icon href=/favicon.ico>
    <link rel=manifest href='data:application/manifest+json,{
      "name":"非官方資訊站",
      "display":"standalone",
      "start_url":"https://go-shoot.github.io/",
      "theme_color":"rgb(181,251,92)",
      "background_color":"black",
      "icons":[{"src":"https://go-shoot.github.io/favicon.ico","type":"image/png","sizes":"120x120"},{"src":"https://go-shoot.github.io/favicon.ico","type":"image/png","sizes":"512x512","purpose":"maskable"}]
    }'>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Dela+Gothic+One&family=IBM+Plex+Sans+JP:wght@500&display=swap" rel="stylesheet">
    <style>body {transition:opacity .5s;opacity:1 !important;}</style>   
    `,
    fetch: () => caches.match(Head.url).then(resp => resp.text()),

    add: async resp => (resp?.headers.get('content-type') || '').includes('text/html') ? 
        new Response(await Head.fetch() + await resp.text(), Head.response(resp)) : resp,
            
    response: ({status, statusText, headers}) => ({status, statusText, headers})
}
const List = {
    essential: [
        //'/parts/bg.svg', 
        'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/jquery.tablesorter/2.31.3/js/jquery.tablesorter.min.js',
    ],
    periodic: [
        '/db/prod-launcher.json',
        '/include/common.js',
        '/parts/parts.js', '/parts/catalog.js',
        '/products/row.js', '/products/maps.js', '/products/table.js',
        '/include/common.css', '/index.css',
        '/parts/catalog.css', '/parts/typography.css',
        '/products/products.css',
        '/products/', '/parts/', '/', '/prize/',
        '/prize/carousel.js',
        '/include/component.css',
        '/include/fonts/Mincho.woff2', '/include/fonts/FiraSans-Regular.woff2', '/include/fonts/FiraSansExtraCondensed-Regular.woff2'
    ],
}
