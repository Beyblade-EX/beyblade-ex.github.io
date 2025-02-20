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
            DB.replace('V2','V3')
            //DB.open('V2')
            .then(Function('', this.getAttribute('callback')))
            .then(() => Storage('error', 0))
            .catch(er => {
                this.error();
                console.error(...[er].flat());
                //let error = Storage('error') ?? 0;
                //error < 2 && Storage('error', error += 1) && location.reload();
            })
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
    replace: (before, after) => indexedDB.databases()
        .then(dbs => dbs.find(db => db.name == before) ? 
            new Promise(res => indexedDB.open(before).onsuccess = res).then(ev => DB.discard(ev.target.result)): 
            Promise.resolve()
        ).then(() => DB.open(after))
    ,
    discard: (db, handler) => (DB.db = db) && DB.transfer.out()
        .then(() => new Promise(res => {
            DB.db.close();
            Object.assign(indexedDB.deleteDatabase(db.name), {        
                onsuccess: () => res(DB.db = null),
                onblocked: handler ?? console.error
            });
        }))
    ,
    transfer: {
        out: () => DB.get.all('user').then(data => sessionStorage.setItem('user', JSON.stringify(data))).catch(() => {}),
        in: () => DB.put('user', JSON.parse(sessionStorage.getItem('user') ?? '[]').map((item, i) => ({[`sheet-${i+1}`] : item})))
    },
    components: ['bit','ratchet','blade','blade-CX'],

    open: (ver) => DB.db ? Promise.resolve() : 
        new Promise(res => Object.assign(indexedDB.open(ver, 1), {onsuccess: res, onupgradeneeded: res}))
        .then(ev => {
            DB.db = ev.target.result;
            let home = location.pathname == '/';
            return ev.type == 'success' ? 
                DB.fetch.updates({fresh: false, home}) : 
                DB.setup(ev.target).then(DB.transfer.in).then(() => DB.fetch.updates({fresh: true, home}));
        }).then(DB.cache)
    ,
    setup ({transaction}) {
        ['product','meta','user'].map(s => DB.db.createObjectStore(s));
        DB.components.map(s => DB.db.createObjectStore(s.toUpperCase(), {keyPath: 'abbr'}).createIndex('group', 'group'));
        return new Promise(res => transaction.oncomplete = res);
    },
    fetch: {
        updates: ({fresh, home}) => fresh && !home ||
            fetch(`/db/-update.json`).catch(() => DB.indicator.setAttribute('status', 'offline'))
            .then(resp => resp.json())
            .then(({news, ...files}) => (home && announce(news), fresh || DB.filter.outdated(files)))
        ,
        files: files => Promise.all(files.map(file => 
                fetch(`/db/${file}.json`)
                .then(resp => Promise.all([file, resp.json(), /^part-/.test(file) && DB.clear(file) ]))
            )).then(arr => arr.map(([file, json]) => //in one transaction
                (DB.actions[file] || DB.put.parts)(json, file)
                .then(() => console.log(`Updated '${file}'`) ?? Storage('DB', {[file]: Math.round(new Date() / 1000)} ))
                .catch(er => console.error(file, er))
            ))
    },
    filter: {
        outdated: files => [...new O(files)].filter(([file, time]) => new Date(time) / 1000 > (Storage('DB')?.[file] || 0)).map(([file]) => file),
    },
    cache (files) {
        if (Array.isArray(files) && !files.length) 
            return DB.indicator.hidden = true;
        DB.indicator.init(files);
        files = Object.keys(DB.actions).filter(f => files === true ? true : files.includes(f));
        return DB.fetch.files(files).then(() => DB.indicator.update(true));
    },
    actions: {
        'part-blade': '', 'part-blade-CX': '', 'part-ratchet': '', 'part-bit': '',
        'part-meta': (json) => DB.put('meta', {part: json}),
        'prod-launchers': (json) => DB.put('product', {launchers: json}),
        'prod-others': (json) => DB.put('product', {others: json}),
        'prod-beys': (beys) => DB.put('product', [{beys}, {schedule: beys.filter(bey => bey[1].includes('BXG') || !bey[1].includes('H')).map(bey => bey[2].split(' '))}]),
    },

    trans: (store) => DB.tr = Object.assign(DB.db.transaction(DB.store.format(store), 'readwrite')),

    store: (store) => (s => DB.trans(s).objectStore(s))(DB.store.format(store)),

    get: (store, key) => {
        !key && ([store, key] = store.split('.').reverse());
        /^.X$/.test(store) && (store = `blade-${store}`);
        store == 'user' && (DB.tr = null);
        return new Promise(res => 
            DB.store(store).get(key).onsuccess = ({target: {result}}) => res(result.abbr ? {...result, comp: store.split('-')[0]} : result));
    },
    put: (store, items, callback) => items && new Promise(res => {
        store == 'meta' && (DB.tr = null);
        if (!Array.isArray(items))
            return DB.store(store).put(...items.abbr ? [items] : [...new O(items)][0].reverse()).onsuccess = () => res(callback?.());
        DB.trans(store);
        return Promise.all(items.map(item => DB.put(store, item, callback))).then(res).catch(er => console.error(store, er));
    }),
    clear: file => new Promise(res => DB.store(file).clear().onsuccess = () => res(Storage('DB', {[file]: null})))
}
DB.store.format = store => {
    if (Array.isArray(store)) return store.map(DB.store.format);
    store = store.replace('part-', '');
    return DB.components.includes(store) ? store.toUpperCase() : store;
}
Object.assign(DB.put, {
    parts: (parts, file) => DB.put(file, [...new O(parts)].map(([abbr, part]) => ({...part, abbr}) ), () => DB.indicator.update()),
});
Object.assign(DB.get, {
    all: store => {
        let comp = /(blade|ratchet|bit)/.exec(store)?.[0];
        return new Promise(res => DB.store(store).getAll()
            .onsuccess = ev => res(ev.target.result.map(p => comp ? {...p, comp} : p)));
    },
    parts (comps = DB.components, toNames) {
        comps = [comps].flat().map(c => /^.X$/.test(c) ? `blade-${c}` : c);
        DB.trans(comps);
        return comps.length === 1 && !toNames ? 
            DB.get.all(comps[0]) : 
            Promise.all(comps.map(c => DB.get.all(c).then(parts => [c, parts]))).then(PARTS => toNames ? PARTS : new O(PARTS));
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
