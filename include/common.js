navigator.serviceWorker?.register('/worker.js').then(() =>
    document.querySelector('link[href="/include/common.css"]') ?? location.reload()
);
Q = Node.prototype.Q = function(el, func) {
    let els = this.querySelectorAll?.(el) ?? document.querySelectorAll(el);
    return func ? els.forEach(func) : els.length > 1 ? [...els] : els[0];
}
const E = (el, ...stuff) => {
    let [text, attr, children] = ['String', 'Object', 'Array'].map(t => stuff.find(s => Object.prototype.toString.call(s).includes(t)));
    text && (attr = {textContent: text, ...attr ?? {}});
    el == 'img' && (attr = {alt: attr.src.match(/([^/.]+)(\.[^/.]+)$/)[1], onerror: ev => ev.target.remove(), ...attr ?? {}});
    el = ['svg', 'use', 'path'].includes(el) ? document.createElementNS('http://www.w3.org/2000/svg', el) : document.createElement(el);
    el.append(...children ?? []);
    Object.assign(el.style, attr?.style ?? {});
    Object.assign(el.dataset, attr?.dataset ?? {});
    return Object.assign(el, (({style, dataset, ...attr}) => attr)(attr ?? {}));
}
const Cookie = {
    ...Object.fromEntries(document.cookie.split(/;\s?/).map(c => c.split('=')).map(([k, v]) => [k, v?.includes('{') ? Cookie.parse(v) : v])),
    set: (k, v) => document.cookie = `${k}=${typeof v == 'object' ? JSON.stringify(Cookie[k] = {...Cookie[k] ?? {}, ...v}) : v}; max-age=99999999; path=/`,
    parse: v => { try { return JSON.parse(v); } catch (e) { return console.error(v) ?? null; } }
};
window.addEventListener('DOMContentLoaded', () => document.title += ' ■ 戰鬥陀螺 X⬧爆旋陀螺 X⬧ベイブレード X⬧Beyblade X');

const nav = links => {
    let icons = {'/': '&#xe000;', '/products/': '&#xe001;', '/prize/': '&#xe002;', '/parts/' : '&#xe003;'};
    Q('nav').innerHTML = links.map(l => l ? `<a href=${l} ${l == '/' ? '' : ''}>${icons[l]}</a>` : '').join('') + `
    <!--div class=menu-scroll>
        <label onclick=window.scrollTo(0,0) data-icon=></label>
        <label onclick=window.scrollTo(0,document.body.scrollHeight) data-icon=></label>
    </div-->`;
}

class Indicator extends HTMLElement {
    constructor() {
        super();
        [this.progress, this.total] = [0, Cookie.count || 495];
        this.attachShadow({mode: 'open'}).innerHTML = `
        <style>
        :host(:not([progress]):not([status])) {display:none;}
        :host {
            position:relative;
            background:radial-gradient(circle at center var(--p),hsla(0,0%,100%,.2) 70%, var(--on) 70%);
            background-clip:text;-webkit-background-clip:text;
            display:inline-block;min-height:5rem;
        }
        :host([style*='--c']) {
            background:var(--c);
            background-clip:text;-webkit-background-clip:text;
        }
        :host([title])::after {
            content:attr(title) ' ' attr(progress);
            position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
            color:white;font-size:.9em;
            width:4.7rem;
        }
        :host::before {
            font-size:5rem;color:transparent;
            content:'\e006';
        }
        :host([status=offline])::before {content:'\e007';}
        </style>`;
    }
    connectedCallback() {
        window.addEventListener('DOMContentLoaded', () => DB.open().then(familiar =>
            location.pathname == '/' ? DB.check(familiar) :
            location.pathname == '/parts/' ? location.search && Parts.catalog() || location.hash && Parts.list() :
            location.pathname == '/products/' ? Table() : null
        ).catch(er => (document.body.append(er), console.error(er))));
    }
    attributeChangedCallback(_, __, value) {
        value == 'success' && this.style.setProperty('--p', 40 - 225 + '%');
        this.style.setProperty('--c', value == 'success' ? 'lime' : 'deeppink');
        this.title = value == 'success' ? '更新成功' : value == 'offline' ? '離線' : '';
    }
    init(update) {
        this.title = update ? '更新中' : '首次訪問 預備中';
        this.setAttribute('progress', this.progress = 0);
    }
    update(finish) {
        finish || ++this.progress == this.total ?
            this.setAttribute('status', 'success') : 
            this.style.setProperty('--p', 40 - 225 * this.progress / this.total + '%');
        this.setAttribute('progress', this.progress);
    }
    error(ev) {
        this.setAttribute('status', 'error');
        this.title = ev.target.errorCode;
    }
    static observedAttributes = ['status'];
}
customElements.define('db-status', Indicator);

const DB = {
    db: null,
    get indicator() {return DB._indicator ??= Q('db-status');},
    discard: (db, handler) => new Promise(res => {
        db == 'V6' && DB.db?.close();
        let deleting = indexedDB.deleteDatabase(db);
        deleting.onsuccess = () => res(db == 'V6' && (DB.db = null));
        deleting.onblocked = handler ?? (ev => console.error(ev));
    }),
    open: () => new Promise(res => {
        if (DB.db) return res(true);
        let opening = indexedDB.open('V2', 1), familiar;
        opening.onerror = DB.indicator.error;
        opening.onsuccess = () => ((DB.db = opening.result).onerror = opening.onerror) && (familiar ?? res(true));
        opening.onupgradeneeded = () => (familiar = false) || DB.init(opening).then(DB.cache).then(() => res(false)).catch(opening.onerror);
    }),
    init: ({result, transaction}) => new Promise(res => {
        DB.db = result;
        DB.indicator.init();
        ['meta', 'html'].forEach(store => DB.db.createObjectStore(store));
        DB.db.createObjectStore('parts', {keyPath: 'key'}).createIndex('group', 'group');
        transaction.oncomplete = () => res();
    }),
    cache: async outdated => {
        Q('a', a => a.classList.add('disabled'));
        DB.indicator.init(outdated);
        let update = (files, ...args) => DB.update(files.filter(f => outdated ? Object.keys(outdated).includes(f) : true), ...args);
        await Promise.all([
            update(['beys'].map(f => `prod-${f}`), (json, file) => DB.put('html', [file, json])),
            update(['bit', 'ratchet', 'blade'], DB.put.parts, (sym, comp) => outdated?.[comp]?.includes(sym) ?? true),
            //update(['layer7', 'layer6', 'layer5'],       json => Promise.all(Object.entries(json).map(([comp, parts]) => DB.put.parts(parts, comp)))),
            update(['meta'],                             json => Promise.all(Object.entries(json).map(info => DB.put('meta', info))))
        ]);
        Q('a.disabled', a => a.classList.remove('disabled'));
        DB.indicator.progress > (Cookie.count ?? 0) && Cookie.set('count', DB.indicator.progress);
    },
    check: async familiar => {
        let updates = await fetch(`/db/-update.json?${Math.random()}`).catch(() => DB.indicator.setAttribute('status', 'offline'))
            .then(resp => resp.json()).then(({news, ...updates}) => (typeof announce != 'undefined' && announce(news), updates));
        if (!familiar) return;
        let outdated = Object.entries(updates).reduce((obj, [item, [time, which]]) => new Date(time) / 1000 > (Cookie.history?.[item] || 0) ? {...obj, [item]: which} : obj, {});
        Object.keys(outdated).length && fetch('/sw/delete?' + Object.keys(outdated).filter(item => /^layer|disk|driver/.test(item)))
            .then(() => DB.cache(outdated)).then(() => DB.indicator.update(true));
    },
    update: (files, action, filter) => Promise.all(files.map(file => 
        fetch(`/db/${file}.json?${Math.random()}`).then(resp => resp.json()).then(json => action(json, file, filter))
        .then(() => Cookie.set('history', {[file]: Math.round(new Date() / 1000)})).catch(er => console.error(er))
    )),
    store: (...args) => DB.db.transaction(...args).objectStore(args[0]),
    put: (store, obj) => new Promise(res => DB.store(store, 'readwrite').put(...Array.isArray(obj) ? obj.reverse() : [obj]).onsuccess = res),
    get: (store, key) => new Promise(res => DB.store(store).get(key).onsuccess = ev => res(ev.target.result)),
}
Object.assign(DB.put, {
    parts: (parts, group, filter = () => true) => new Promise(res => {
        let tran = DB.db.transaction('parts', 'readwrite');
        Object.entries(parts).forEach(([sym, part]) => 
            filter(sym, group) && (tran.objectStore('parts').put({group, ...part, key: `${sym}.${group}`}).onsuccess = () => DB.indicator.update())
        );
        tran.oncomplete = res;
    }),
});
Object.assign(DB.get, {
    names: () => Promise.all(['blade', 'ratchet', 'bit'].map(comp => Fetch(`/db/part-${comp}.json`).then(resp => resp.json())))
        .then(([blade, ratchet, bit]) => ({
            blade: Object.fromEntries(Object.entries(blade).map(([sym, {names}]) => [sym, names])), 
            ratchet: Object.fromEntries(Object.entries(ratchet).map(([sym]) => [sym, {}])), 
            bit: Object.fromEntries(Object.entries(bit).map(([sym, {names}]) => [sym, names])), 
        })),
    //names: () => new Promise(res => {
    //    const names = {}, recurrent = [];
    //    DB.store('parts').openCursor().onsuccess = ev => {
    //        let {key, names: name} = ev.target.result?.value ?? {};
    //        if (!key) {
    //            recurrent.forEach(([sym, comp, symRef, compRef]) => names[comp][sym] = names[compRef ?? 'layer7c'][symRef]);
    //            return res(names);
    //        }
    //        let [sym, comp] = key.split('.');
    //        typeof name == 'string' ? 
    //            recurrent.push([sym, comp, ...name.split('.')]) :
    //            names[comp] = {...names[comp] ?? {}, [sym]: (({can, ...others}) => others)(name ?? {})};
    //        ev.target.result.continue();
    //    }
    //}),
    parts: group => new Promise(res => DB.store('parts').index('group').getAll(group).onsuccess = ev => res(ev.target.result)),
    keys: group => new Promise(res => DB.store('parts').index('group').getAllKeys(group).onsuccess = ev => res(ev.target.result)),
});

class Mapping {
    constructor(...map) {
        this.default = map.length % 2 ? map.pop() : null;
        this.map = map.reduce((pairs, item, i) => i % 2 ? pairs.at(-1).push(item) && pairs : [...pairs, [item[0] == '/' ? new RegExp(item.slice(1, -1)) : item]], []);
    }
    find = (...keys) => {
        let found, evaluate = typeof keys.at(-1) == 'boolean' && keys.pop();
        let key = keys.find(key => (found = 
            this.map.find(([k]) =>
                k instanceof RegExp && k.test(key) || k instanceof Array && k.find(item => item == key) ||
                k instanceof Function && k(key) || k == key
            )?.[1] ?? this.default
        ) != null);
        if (found instanceof Function)
            return evaluate ? found(key) : found;
        if (found instanceof Array)
            return found.map(item => typeof item == 'string' ? item.replaceAll('${}', key) : (item ?? ''));
        return found && typeof found == 'string' ? found.replaceAll('${}', key) : (found ?? '');
    }
    static maps = {};
}
let files = {
    updated: JSON.parse(localStorage.getItem('updated') || '{}'),
    stored: JSON.parse(localStorage.getItem('stored') || '{}')
}
location.pathname == '/' && fetch('/db/-update.json').then(resp => resp.json())
.then(({news, ...others}) => Object.entries(others).forEach(([url, [time]]) => files.updated[url] = new Date(time).getTime()))
.then(() => localStorage.setItem('updated', JSON.stringify(files.updated)));

const Fetch = async url => {
    if (files.stored[url] >= files.updated[url]) 
        return console.log(`cache: ${url}`) ?? caches.match(url);
    return console.log(`fetch: ${url}`) ?? fetch(url).then(resp => caches.open('json').then(cache => {
        cache.add(url, resp);
        localStorage.setItem('stored', JSON.stringify(files.stored = {...files.stored, [url]: new Date().getTime()}));
        return resp;
    }));
}
