customElements.define('db-status', class extends HTMLElement {
    constructor() {
        super();
        [this.progress, this.total] = [0, Storage('DB')?.count || 100];
        this.attachShadow({mode: 'open'}).innerHTML = `
        <style>
        :host(:not([progress]):not([status]))::before {color:white;}
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
        Q('link[href$="common.css"]') && addEventListener('DOMContentLoaded', () => 
            DB.open().then(Function('', this.getAttribute('callback'))).catch(er => (document.body.append(er), console.error(er)))
        );
    }
    attributeChangedCallback(_, __, value) {
        if (value == 'success') {
            this.style.setProperty('--p', 40 - 225 + '%');
            this.progress > (Storage('DB')?.count ?? 0) && Storage('DB', {count: this.progress});
            setTimeout(() => this.hidden = true, 2000);
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
    error(er) {
        this.setAttribute('status', 'error');
        //this.title = `${er}`;
    }
    static observedAttributes = ['status'];
});

const DB = {
    components: ['bit', 'blade', 'ratchet'],
    current: 'V2',
    discard: (ver = DB.current, handler) => DB.transfer.out().then(() => new Promise(res => {
        ver == DB.current && DB.db?.close();
        Object.assign(indexedDB.deleteDatabase(ver), {        
            onsuccess: () => res(ver == DB.current && (DB.db = null)),
            onblocked: handler ?? console.error
        });
    })),
    transfer: {
        out: () => Promise.resolve(),//DB.get.all('user').then(data => sessionStorage.setItem('user', JSON.stringify(data))),
        in: () => Promise.resolve()//DB.put('user', JSON.parse(sessionStorage.getItem('user') ?? '[]').map(item => ({[Array.isArray(item) ? '#deck' : '#tier'] : item})))
    },
    open: () => DB.db ? true : 
        new Promise(res => Object.assign(indexedDB.open(DB.current, 1), {onsuccess: res, onupgradeneeded: res}))
        .then(ev => ev.type == 'success' ? DB.check(ev.target) : DB.setup(ev.target))
        .then(DB.cache).catch(er => DB.indicator.error(er) ?? console.error(er)),

    setup ({result, transaction}) {
        DB.db = result;
        ['product','meta','user'].map(s => DB.db.createObjectStore(s));
        DB.components.map(s => DB.db.createObjectStore(`.${s}`, {keyPath: 'abbr'}).createIndex('group', 'group'));
        return new Promise(res => transaction.oncomplete = res).then(() => (DB.transfer.in(), DB.updates(true)));
    },
    check ({result}) {
        DB.db = result;        
        return DB.updates(false);
    },
    updates (fresh) {
        if (location.pathname != '/' && fresh) return null;
        let compare = files => Object.entries(files).filter(([file, time]) => new Date(time) / 1000 > (Storage('DB')?.[file] || 0)).map(([file]) => file);
        return fetch(`/db/-update.json`).catch(() => DB.indicator.setAttribute('status', 'offline'))
        .then(resp => resp.json()).then(({news, ...files}) => {
            location.pathname == '/' && announce(news);
            return fresh ? null : compare(files);
        });
    },
    cache (outdated) {
        if (outdated && !outdated.length) return DB.indicator.hidden = true;
        DB.indicator.init(outdated);
        outdated = Object.keys(DB.action).filter(f => outdated?.some(p => p.includes(f)) ?? true);
        return DB.fetch(outdated).then(() => DB.indicator.update(true)).catch(() => DB.indicator.error());
        //update(['layer7', 'layer6', 'layer5'],       json => Promise.all(Object.entries(json).map(([comp, parts]) => DB.put.parts(parts, comp)))),
    },
    action: {
        'part-blade': (...args) => DB.put.parts(...args),
        'part-ratchet': (...args) => DB.put.parts(...args),
        'part-bit': (...args) => DB.put.parts(...args),
        'part-meta': (json) => DB.put('meta', {part: json}),
        'prod-launchers': (json) => DB.put('product', {launchers: json}),
        'prod-others': (json) => DB.put('product', {others: json}),
        'prod-beys': (beys) => DB.put('product', [{beys}, {schedule: beys.map(bey => bey[2].split(' '))}]),
    },
    fetch: files => Promise.all(files.map(file => 
            fetch(`/db/${file}.json`).then(resp => Promise.all([file, resp.json(), DB.clear(file.match(/[^-]+$/)[0]) ]))
        )).then(ar => ar.map(([file, json]) => 
            DB.action[file](json, file).then(() => Storage('DB', {[file]: Math.round(new Date() / 1000)} ))
        )).catch(er => (console.error(file), console.error(er))),

    trans: (store) => DB.tr?.objectStoreNames.contains(store) ? DB.tr : 
        DB.tr = Object.assign(DB.db.transaction(store, 'readwrite'), {oncomplete: () => DB.tr = null}),

    store: (...args) => DB.trans(...args).objectStore(args[0]),

    get: (store, key) => {
        !key && ([store, key] = store.split('.').reverse());
        let part = DB.components.includes(store);
        return new Promise(res => DB.store(part ? `.${store}` : store).get(key)
            .onsuccess = ev => res(part ? {...ev.target.result, comp: store} : ev.target.result));
    },
    put: (store, items, success) => items && new Promise(res => {
        if (!Array.isArray(items))
            return DB.store(store).put(...items.abbr ? [items] : Object.entries(items)[0].reverse()).onsuccess = () => res(success?.());
        DB.trans(store);
        Promise.all(items.map(item => DB.put(store, item, success))).then(res);
    }),
    clear: (store) => new Promise(res => DB.store(DB.components.includes(store) ? `.${store}` : store).clear()
            .onsuccess = () => res(Storage('DB', {[`part-${store}`]: null}))
        ).catch(() => {})
}
Object.assign(DB.put, {
    parts: (parts, file) => DB.put(file.replace('part-', '.'), Object.entries(parts).map(([abbr, part]) => ({...part, abbr}) ), () => DB.indicator.update()),
});
Object.assign(DB.get, {
    all: store => {
        let part = DB.components.includes(store);
        return new Promise(res => DB.store(part ? `.${store}` : store).getAll()
            .onsuccess = ev => res(ev.target.result.map(p => part ? {...p, comp: store} : p)));
    },
    parts (comps = DB.components, toNames) {
        comps = [comps].flat();
        DB.trans(comps.map(c => `.${c}`));
        return comps.length === 1 && !toNames ? 
            DB.get.all(comps[0]) : 
            Promise.all(comps.map(c => DB.get.all(c).then(parts => [c, parts]))).then(PARTS => toNames ? PARTS : Object.fromEntries(PARTS));
    },
    names: (comps = DB.components) => DB.get.parts(comps, true).then(PARTS => 
        Object.fromEntries(PARTS.map(([comp, parts]) => [comp, parts.reduce((obj, {abbr, names}) => ({...obj, [abbr]: names}), {})]))
    ),
    async meta (comp, category) {
        let meta = await DB.get('meta', 'part');
        meta = comp ? {...meta[comp][category], ...meta[comp]._} : meta.bit._;
        let bit = !comp || comp == 'bit' ? {prefix: Object.keys(meta.prefix).join('')} : {};
        return {meta, bit, types: ['att', 'bal', 'def', 'sta']};
    },
});
