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
            color:var(--on);font-size:.9em;
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
            DB.open().then(Function('', this.getAttribute('callback')))
            .catch(er => [console.error(er), (DB.errors ??= 0)++ <= 2 && location.reload()])
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
    components: ['bit','ratchet','blade','blade-CX'],
    current: 'V2',
    discard: (ver = DB.current, handler) => DB.transfer.out().then(() => new Promise(res => {
        ver == DB.current && DB.db?.close();
        Object.assign(indexedDB.deleteDatabase(ver), {        
            onsuccess: () => res(ver == DB.current && (DB.db = null)),
            onblocked: handler ?? console.error
        });
    })),
    transfer: {
        out: () => DB.get.all('user').then(data => sessionStorage.setItem('user', JSON.stringify(data))),
        in: () => DB.put('user', JSON.parse(sessionStorage.getItem('user') ?? '[]').map(item => ({[Array.isArray(item) ? '#deck' : '#tier'] : item})))
    },
    open: () => DB.db ? true : 
        new Promise(res => Object.assign(indexedDB.open(DB.current, 2), {onsuccess: res, onupgradeneeded: res}))
        .then(ev => ev.type == 'success' ? DB.check(ev.target) : DB.setup(ev.target, ev.oldVersion))
        .then(DB.cache).catch(er => DB.indicator.error(er) ?? console.error(er)),

    async setup ({result, transaction}, ver) {
        DB.db = result;
        if (ver === 1) 
            DB.db.createObjectStore(`.blade-CX`, {keyPath: 'abbr'}).createIndex('group', 'group');
        else {
            ['product','meta','user'].map(s => DB.db.createObjectStore(s));
            DB.components.map(s => DB.db.createObjectStore(`.${s}`, {keyPath: 'abbr'}).createIndex('group', 'group'));
        }
        await new Promise(res => transaction.oncomplete = res);
        DB.transfer.in();
        DB.updates(true);
    },
    check ({result}) {
        DB.db = result;        
        return DB.updates(false);
    },
    updates (fresh) {
        if (location.pathname != '/' && fresh) return null;
        let compare = files => [...new O(files)].filter(([file, time]) => new Date(time) / 1000 > (Storage('DB')?.[file] || 0)).map(([file]) => file);
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
    },
    action: {
        'part-blade': (...args) => DB.put.parts(...args),
        'part-blade-CX': (...args) => DB.put.parts(...args),
        'part-ratchet': (...args) => DB.put.parts(...args),
        'part-bit': (...args) => DB.put.parts(...args),
        'part-meta': (json) => DB.put('meta', {part: json}),
        'prod-launchers': (json) => DB.put('product', {launchers: json}),
        'prod-others': (json) => DB.put('product', {others: json}),
        'prod-beys': (beys) => DB.put('product', [{beys}, {schedule: beys.filter(bey => bey[1].includes('BXG') || !bey[1].includes('H')).map(bey => bey[2].split(' '))}]),
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
        /^.X$/.test(store) && (part = true) && (store = `blade-${store}`);
        store == 'user' && (DB.tr = null);
        return new Promise(res => DB.store(part ? `.${store}` : store).get(key)
            .onsuccess = ev => res(part ? {...ev.target.result, comp: store.split('-')[0]} : ev.target.result));
    },
    put: (store, items, callback) => items && new Promise(res => {
        store == 'meta' && (DB.tr = null);
        if (!Array.isArray(items))
            return DB.store(store).put(...items.abbr ? [items] : [...new O(items)][0].reverse()).onsuccess = () => res(callback?.());
        DB.trans(store);
        Promise.all(items.map(item => DB.put(store, item, callback))).then(res).catch(er => (console.error(store), console.error(er)));
    }),
    clear: (store) => new Promise(res => DB.store(DB.components.includes(store) ? `.${store}` : store).clear()
            .onsuccess = () => res(Storage('DB', {[`part-${store}`]: null}))
        ).catch(() => {})
}
Object.assign(DB.put, {
    parts: (parts, file) => DB.put(file.replace('part-', '.'), [...new O(parts)].map(([abbr, part]) => ({...part, abbr}) ), () => DB.indicator.update()),
});
Object.assign(DB.get, {
    all: store => {
        let comp = /(blade|ratchet|bit)/.exec(store)[0];
        return new Promise(res => DB.store(comp && !store.includes('.') ? `.${store}` : store).getAll()
            .onsuccess = ev => res(ev.target.result.map(p => comp ? {...p, comp} : p)));
    },
    parts (comps = DB.components, toNames) {
        comps = [comps].flat().map(c => /^.X$/.test(c) ? `.blade-${c}` : `.${c}`);
        DB.trans(comps);
        return comps.length === 1 && !toNames ? 
            DB.get.all(comps[0]) : 
            Promise.all(comps.map(c => DB.get.all(c).then(parts => [c.replace('.', ''), parts]))).then(PARTS => toNames ? PARTS : new O(PARTS));
    },
    names: (comps = DB.components) => DB.get.parts(comps, true).then(PARTS => {
        let NAMES = {};
        PARTS.forEach(([comp, parts]) => {
            ['blade','ratchet','bit'].includes(comp) && (NAMES[comp] = parts.reduce((obj, {abbr, names}) => ({...obj, [abbr]: names}), {}));
            comp.includes('-') && (NAMES.blade[comp.split('-')[1]] 
                = parts.reduce((obj, {group, abbr, names}) => ({...obj, [group]: {...obj[group], [abbr]: names} }), {}));
        });
        return NAMES;
    }),
    async meta (comp, category) {
        let meta = await DB.get('meta', 'part');
        comp && (Parts.meta = {...meta[comp][category], ...meta[comp]._});
        PARTS ??= {
            types: ['att', 'bal', 'def', 'sta'],
            prefixes: {bit: new KeysAsString(new O(meta.bit._.prefix).map(null, ({eng, jap}) => ({eng, jap})))}
        };
    },
});
