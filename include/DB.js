customElements.define('db-status', class extends HTMLElement {
    constructor() {
        super();
        [this.progress, this.total] = [0, Cookie.count || 100];
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
            content:'\\e006';
        }
        :host([status=offline])::before {content:'\\e007';}
        </style>`;
    }
    connectedCallback() {
        DB.indicator = this;
        addEventListener('DOMContentLoaded', () => 
            DB.open().then(Function('', this.getAttribute('callback'))).catch(er => (document.body.append(er), console.error(er)))
        );
    }
    attributeChangedCallback(_, __, value) {
        if (value == 'success') {
            this.style.setProperty('--p', 40 - 225 + '%');
            this.progress > (Cookie.count ?? 0) && Cookie.set('count', this.progress);
            setTimeout(() => this.remove(), 2000);
        }
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
});

const DB = {
    components: ['blade', 'ratchet', 'bit'],
    current: 'V2',
    discard: (ver, handler) => new Promise(res => {
        ver == DB.current && DB.db?.close();
        Object.assign(indexedDB.deleteDatabase(ver), {        
            onsuccess: () => res(ver == DB.current && (DB.db = null)),
            onblocked: handler ?? console.error
        });
    }),
    open: () => DB.db ? true : 
        new Promise(res => Object.assign(indexedDB.open(DB.current, 1), {onsuccess: res, onupgradeneeded: res}))
        .then(ev => ev.type == 'success' ? DB.check(ev.target) : DB.setup(ev.target))
        .then(DB.cache).then(() => DB.indicator.update(true)).catch(er => DB.indicator.error(er) ?? console.error(er)),

    setup: ({result, transaction}) => new Promise(res => {console.log('setup');
        DB.db = result, DB.fresh = true;
        DB.components.forEach(s => DB.db.createObjectStore(`.${s}`, {keyPath: 'abbr'}).createIndex('group', 'group'));
        ['meta','html','user'].forEach(s => DB.db.createObjectStore(s));
        transaction.oncomplete = () => res();
    }),
    check ({result}) {
        DB.db = result;
        if (location.pathname != '/' && DB.fresh) return Promise.resolve(false);
        let compare = files => Object.entries(files).filter(([file, time]) => new Date(time) / 1000 > (localStorage.getItem(file) || 0)).map(([file]) => file);
        console.log('check');
        return fetch(`/db/-update.json?${Math.random()}`).catch(() => DB.indicator.setAttribute('status', 'offline'))
        .then(resp => resp.json()).then(({news, ...files}) => {
            location.pathname == '/' && announce(news);
            return !DB.fresh && compare(files);
        });
    },
    cache (outdated) {
        if (outdated === false) return console.log('first time, no check');
        console.log(outdated);
        Q('a', a => a.classList.add('disabled'));
        DB.indicator.init(outdated);
        return Promise.all(Object.keys(DB.action).map(f => (outdated?.some(p => p.includes(f)) ?? true) && DB.fetch(f)))
        .then(() => Q('a.disabled', a => a.classList.remove('disabled')));
        //update(['beys'].map(f => `prod-${f}`), (json, file) => DB.put('html', [file, json])),
        //update(['layer7', 'layer6', 'layer5'],       json => Promise.all(Object.entries(json).map(([comp, parts]) => DB.put.parts(parts, comp)))),
        //update(['part-meta'], json => Promise.all(Object.entries(json).map(info => DB.put('meta', info))))
    },
    action: {
        'part-blade': (...args) => DB.put.parts(...args),
        'part-ratchet': (...args) => DB.put.parts(...args),
        'part-bit': (...args) => DB.put.parts(...args),
        'part-meta': (json) => DB.put('meta', {part: json}),
        'prod-beys': (beys) => DB.put('products', {schedule: beys.map(bey => bey[2])}),
    },
    fetch: file => fetch(`/db/${file}.json?${Math.random()}`).then(resp => console.log('fetch '+file)??resp.json())
        .then(json => DB.action[file](json, file)).then(() => localStorage.setItem(`/db/${file}.json`, Math.round(new Date() / 1000)))
        .catch(er => console.error(er)),

    trans: (store, mode, oncomplete) => console.log('new tran '+store)??Object.assign(DB.db.transaction(store, mode), {oncomplete}),
    store: (...args) => DB.trans(...args).objectStore(args[0]),

    get: (store, key) => {
        let part = DB.components.includes(store);
        return new Promise(res => DB.store(part ? `.${store}` : store).get(key).onsuccess = ev => res(
            part ? {...ev.target.result, comp: store} : ev.target.result
        ));
    },
    put: (store, items, success) => items && new Promise(res => {
        if (Array.isArray(items)) {
            DB.tr = DB.trans(store, 'readwrite', () => res(DB.tr = null));
            items.forEach(c => DB.put(store, c, success));
        } else {
            DB.tr ??= DB.trans(store, 'readwrite', () => res(DB.tr = null));
            DB.tr.objectStore(store).put(...items.abbr ? [items] : Object.entries(items)[0].reverse()).onsuccess = success;
        }
    }).catch(console.error),
}
Object.assign(DB.put, {
    parts: (parts, file) => DB.put(file.replace('part-', '.'), Object.entries(parts).map(([abbr, part]) => ({...part, abbr}) ), () => DB.indicator.update()),
});
Object.assign(DB.get, {
    names: (comps = ['blade', 'bit']) => 
        Promise.all(comps.map(comp => Fetch(`/db/part-${comp}.json`).then(resp => resp.json())))
        .then(PARTS => comps.reduce((obj, comp, i) => ({...obj, 
            [comp]: Object.fromEntries(Object.entries(PARTS[i]).map(([sym, {names}]) => [sym, names])), 
        }), {})),
    all: comp => new Promise(res => DB.tr.objectStore(`.${comp}`).getAll().onsuccess = ev => res(ev.target.result.map(p => ({...p, comp})))),
    parts (comps = DB.components, toNames) {
        comps = [comps].flat();
        DB.tr = DB.trans(comps.map(c => `.${c}`), 'readonly', () => DB.tr = null);
        return comps.length === 1 && !toNames ? 
            DB.get.all(comps[0]) : 
            Promise.all(comps.map(c => DB.get.all(c).then(parts => [c, parts]))).then(PARTS => toNames ? PARTS : Object.fromEntries(PARTS));
    },
    _names: (comps = ['blade', 'bit']) => DB.get.parts(comps, true).then(PARTS => 
        Object.fromEntries(PARTS.map(([comp, parts]) => [comp, parts.reduce((obj, {abbr, names}) => ({...obj, [abbr]: names}), {})]))
    ),
    async meta (comp, category) {
        let meta = await (await Fetch('/db/part-meta.json')).json();
        meta = comp ? {...meta[comp][category], ...meta[comp]._} : meta.bit._;
        let bit = !comp || comp == 'bit' ? {prefix: Object.keys(meta.prefix).join('')} : {};
        return {meta, bit, types: ['att', 'bal', 'def', 'sta']};
    },
});
