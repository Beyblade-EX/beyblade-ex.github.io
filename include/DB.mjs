import {KeysAsString, Storage} from "./utilities.js"
const DB = callback => DB.indicator = new DB.indicator(callback);
Object.assign(DB, {
    current: 'V3',
    replace: (before, after) => indexedDB.databases()
        .then(dbs => dbs.find(db => db.name == before) && DB.open(before).then(DB.discard))
        .then(() => DB.open(after))
    ,
    discard: (name, handler) => (name != DB.db?.name ? DB.open(name) : Promise.resolve())
        .then(DB.transfer.out).then(() => new Promise(res => {
            DB.db.close();
            Object.assign(indexedDB.deleteDatabase(DB.db.name), {        
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

    open: (name = DB.current) => name == DB.db?.name ? Promise.resolve(DB.db) : 
        new Promise(res => Object.assign(indexedDB.open(name, 1), {onsuccess: res, onupgradeneeded: res}))
        .then(ev => {
            DB.db = ev.target.result;
            if (DB.db.name != DB.current) return;
            let [index, fresh] = [location.pathname == '/', ev.type != 'success'];
            return fresh ? 
                DB.setup(ev).then(DB.transfer.in).then(() => DB.fetch.updates({fresh, index})).then(DB.cache) :
                DB.fetch.updates({fresh, index}).then(DB.cache);
        })
    ,
    setup (ev) {
        ['product','meta','user'].forEach(s => DB.db.createObjectStore(s));
        DB.components.map(s => DB.db.createObjectStore(s.toUpperCase(), {keyPath: 'abbr'}).createIndex('group', 'group'));
        return new Promise(res => ev.target.transaction.oncomplete = res);
    },
    fetch: {
        updates: ({fresh, index}) => fresh && !index ||
            fetch(`/db/-update.json`).catch(() => DB.indicator.setAttribute('status', 'offline'))
            .then(resp => resp.json())
            .then(({news, ...files}) => (index && DB.plugins?.announce(news), fresh || DB.cache.filter(files)))
        ,
        files: files => Promise.all(files.map(file => 
                fetch(`/db/${file}.json`)
                .then(resp => Promise.all([file, resp.json(), /^part-/.test(file) && DB.clear(file) ]))
            )).then(arr => arr.map(([file, json]) => //in one transaction
                (DB.cache.actions[file] || DB.put.parts)(json, file)
                .then(() => console.log(`Updated '${file}'`) ?? Storage('DB', {[file]: Math.round(new Date() / 1000)} ))
                .catch(er => console.error(file, er))
            ))
    },
    cache (files) {
        if (Array.isArray(files) && !files.length) 
            return DB.indicator.hidden = true;
        DB.indicator.init(files);
        files = Object.keys(DB.cache.actions).filter(f => files === true ? true : files.includes(f));
        return DB.fetch.files(files).then(() => DB.indicator.update(true));
    },
    trans: store => DB.tr = Object.assign(DB.db.transaction(DB.store.format(store), 'readwrite')),

    store: store => (s => DB.trans(s).objectStore(s))(DB.store.format(store)),

    get (store, key) {
        !key && ([store, key] = store.split('.').reverse());
        /^.X$/.test(store) && (store = `blade-${store}`);
        store == 'user' && (DB.tr = null);
        return new Promise(res => 
            DB.store(store).get(key).onsuccess = ({target: {result}}) => res(result?.abbr ? {...result, comp: store.split('-')[0]} : result));
    },
    put: (store, items, callback) => items && new Promise(res => {
        store == 'meta' && (DB.tr = null);
        if (!Array.isArray(items))
            return DB.store(store).put(...items.abbr ? [items] : [...new O(items)][0].reverse()).onsuccess = () => res(callback?.());
        DB.trans(store);
        return Promise.all(items.map(item => DB.put(store, item, callback))).then(res).catch(er => console.error(store, er));
    }),
    clear: file => new Promise(res => DB.store(file).clear().onsuccess = () => res(Storage('DB', {[file]: null}))),

    indicator: class extends HTMLElement {
        constructor(callback) {
            super();
            this.callback = callback;
            this.attachShadow({mode: 'open'}).append(E('style', this.#css));
        }
        connectedCallback() {
            [this.progress, this.total] = [0, Storage('DB')?.count || 100];
            Q('link[href$="common.css"]') && DB.replace('V2', DB.current).then(this.callback).catch(this.error);
        }
        attributeChangedCallback(_, __, state) {
            if (state == 'success') {
                E(this).set({'--p': 40 - 225 + '%'});
                this.progress > (Storage('DB')?.count ?? 0) && Storage('DB', {count: this.progress});
                setTimeout(() => this.hidden = true, 2000);
            }
            E(this).set({'--c': state == 'success' ? 'lime' : 'deeppink'});
            this.title = state == 'success' ? '更新成功' : state == 'offline' ? '離線' : '';
        }
        init(update) {
            this.title = update ? '更新中' : '首次訪問 預備中';
            this.setAttribute('progress', this.progress = 0);
        }
        update(finish) {
            finish || ++this.progress == this.total ?
                this.setAttribute('state', 'success') : 
                E(this).set({'--p': 40 - 225 * this.progress / this.total + '%'});
            this.setAttribute('progress', this.progress);
        }
        error(er) {
            console.error(...[er].flat());
            this.setAttribute('state', 'error');
        }
        static observedAttributes = ['state'];
        #css = `
            :host(:not([progress]):not([state]))::before {color:white;}
            :host {
                position:relative;
                background:radial-gradient(circle at center var(--p),hsla(0,0%,100%,.2) 70%, var(--on) 70%);
                background-clip:text; -webkit-background-clip:text;
                display:inline-block; min-height:5rem;
            }
            :host([style*='--c']) {
                background:var(--c);
                background-clip:text; -webkit-background-clip:text;
            }
            :host([title])::after {
                content:attr(title) ' ' attr(progress);
                position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
                color:var(--on); font-size:.9em;
                width:4.7rem;
            }
            :host::before {
                font-size:5rem; color:transparent;
                content:'\\e006';
            }
            :host([state=offline])::before {content:'\\e007';}
        `
    },
});
Object.assign(DB.cache, {
    actions: {
        'part-blade': '', 'part-blade-CX': '', 'part-ratchet': '', 'part-bit': '',
        'part-meta': json => DB.put('meta', {part: json}),
        'prod-launchers': json => DB.put('product', {launchers: json}),
        'prod-others': json => DB.put('product', {others: json}),
        'prod-beys': beys => DB.put('product', [{beys}, {schedule: beys.filter(bey => bey[1].includes('BXG') || !bey[1].includes('H')).map(bey => bey[2].split(' '))}]),
    },
    filter: files => [...new O(files)].filter(([file, time]) => new Date(time) / 1000 > (Storage('DB')?.[file] || 0)).map(([file]) => file),
});
Object.assign(DB.store, {
    format (store) {
        if (Array.isArray(store)) return store.map(DB.store.format);
        store = store.replace('part-', '');
        return DB.components.includes(store) ? store.toUpperCase() : store;
    }
});
Object.assign(DB.put, {
    parts: (parts, file) => DB.put(file, [...new O(parts)].map(([abbr, part]) => ({...part, abbr}) ), () => DB.indicator.update()),
});
Object.assign(DB.get, {
    all (store) {
        let comp = /(blade|ratchet|bit)/.exec(store)?.[0];
        return new Promise(res => DB.store(store).getAll()
            .onsuccess = ev => res(ev.target.result.map(p => comp ? {...p, comp} : p)));
    },
    parts (comps = DB.components, toNAMES) {
        comps = [comps].flat().map(c => /^.X$/.test(c) ? `blade-${c}` : c);
        DB.trans(comps);
        return comps.length === 1 && !toNAMES ? 
            DB.get.all(comps[0]) : 
            Promise.all(comps.map(c => DB.get.all(c).then(parts => [c, parts]))).then(PARTS => toNAMES ? PARTS : new O(PARTS));
    },
    names: (comps = DB.components) => DB.get.parts(comps, true)
        .then(PARTS => {
            let NAMES = {};
            PARTS.forEach(([comp, parts]) => comp.includes('-') ?
                NAMES.blade[comp.split('-')[1]] = parts.reduce((obj, {group, abbr, names}) => ({...obj, [group]: {...obj[group], [abbr]: names} }), {}) : 
                NAMES[comp] = parts.reduce((obj, {abbr, names}) => ({...obj, [abbr]: names}), {})
            );
            return NAMES;
        })
    ,
    meta: (comp, category) => DB.get('meta', 'part')
        .then(meta => ({
            ...comp ? meta[comp][category] : {}, 
            ...comp ? meta[comp]._ : {},
            types: ['att', 'bal', 'def', 'sta'],
            prefixes: {bit: new KeysAsString(new O(meta.bit._.prefix).map(([k, {eng, jap}]) => [k, {eng, jap}]))}
        })
    ),
});
customElements.define('db-state', DB.indicator);
export default DB