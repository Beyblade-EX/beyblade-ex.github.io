const Storage = (key, obj) => !obj ? 
    JSON.parse(localStorage[key] ?? 'null') : 
    localStorage[key] = typeof obj == 'object' ? JSON.stringify({...Storage(key), ...obj}) : obj;
class KeysAsString {
    constructor(obj) {Object.assign(this, obj);}
    [Symbol.toPrimitive] = type => type == 'string' && Object.keys(this).join('')
};

const _DB = callback => _DB.indicator = new _DB.indicator(callback);
Object.assign(_DB, {
    current: 'V3',
    replace: (before, after) => indexedDB.databases()
        .then(dbs => dbs.find(db => db.name == before) && _DB.open(before).then(_DB.discard))
        .then(() => _DB.open(after))
    ,
    discard: (name, handler) => (name != _DB.db?.name ? _DB.open(name) : Promise.resolve())
        .then(_DB.transfer.out).then(() => new Promise(res => {
            _DB.db.close();
            Object.assign(indexedDB.deleteDatabase(_DB.db.name), {        
                onsuccess: () => res(_DB.db = null),
                onblocked: handler ?? console.error
            });
        }))
    ,
    transfer: {
        out: () => _DB.get.all('user').then(data => sessionStorage.setItem('user', JSON.stringify(data))).catch(() => {}),
        in: () => _DB.put('user', JSON.parse(sessionStorage.getItem('user') ?? '[]').map((item, i) => ({[`sheet-${i+1}`] : item})))
    },
    components: ['bit','ratchet','blade','blade-CX'],

    open: (name = _DB.current) => name == _DB.db?.name ? Promise.resolve(_DB.db) : 
        new Promise(res => Object.assign(indexedDB.open(name, 1), {onsuccess: res, onupgradeneeded: res}))
        .then(ev => {
            _DB.db = ev.target.result;
            if (_DB.db.name != _DB.current) return;
            let [index, fresh] = [location.pathname == '/', ev.type != 'success'];
            return fresh ? 
                _DB.setup(ev).then(_DB.transfer.in).then(() => _DB.fetch.updates({fresh, index})).then(_DB.cache) :
                _DB.fetch.updates({fresh, index}).then(_DB.cache);
        })
    ,
    setup (ev) {
        ['product','meta','user'].forEach(s => _DB.db.createObjectStore(s));
        _DB.components.map(s => _DB.db.createObjectStore(s.toUpperCase(), {keyPath: 'abbr'}).createIndex('group', 'group'));
        return new Promise(res => ev.target.transaction.oncomplete = res);
    },
    fetch: {
        updates: ({fresh, index}) => fresh && !index ||
            fetch(`/db/-update.json`).catch(() => _DB.indicator.setAttribute('status', 'offline'))
            .then(resp => resp.json())
            .then(({news, ...files}) => (index && _DB.plugins?.announce(news), fresh || _DB.cache.filter(files)))
        ,
        files: files => Promise.all(files.map(file => 
                fetch(`/db/${file}.json`)
                .then(resp => Promise.all([file, resp.json(), /^part-/.test(file) && _DB.clear(file) ]))
            )).then(arr => arr.map(([file, json]) => //in one transaction
                (_DB.cache.actions[file] || _DB.put.parts)(json, file)
                .then(() => console.log(`Updated '${file}'`) ?? Storage('_DB', {[file]: Math.round(new Date() / 1000)} ))
                .catch(er => console.error(file, er))
            ))
    },
    cache (files) {
        if (Array.isArray(files) && !files.length) 
            return _DB.indicator.hidden = true;
        _DB.indicator.init(files);
        files = Object.keys(_DB.cache.actions).filter(f => files === true ? true : files.includes(f));
        return _DB.fetch.files(files).then(() => _DB.indicator.update(true));
    },
    trans: store => _DB.tr = Object.assign(_DB.db.transaction(_DB.store.format(store), 'readwrite')),

    store: store => (s => _DB.trans(s).objectStore(s))(_DB.store.format(store)),

    get (store, key) {
        !key && ([store, key] = store.split('.').reverse());
        /^.X$/.test(store) && (store = `blade-${store}`);
        store == 'user' && (_DB.tr = null);
        return new Promise(res => 
            _DB.store(store).get(key).onsuccess = ({target: {result}}) => res(result?.abbr ? {...result, comp: store.split('-')[0]} : result));
    },
    put: (store, items, callback) => items && new Promise(res => {
        store == 'meta' && (_DB.tr = null);
        if (!Array.isArray(items))
            return _DB.store(store).put(...items.abbr ? [items] : [...new O(items)][0].reverse()).onsuccess = () => res(callback?.());
        _DB.trans(store);
        return Promise.all(items.map(item => _DB.put(store, item, callback))).then(res).catch(er => console.error(store, er));
    }),
    clear: file => new Promise(res => _DB.store(file).clear().onsuccess = () => res(Storage('_DB', {[file]: null}))),

    indicator: class extends HTMLElement {
        constructor(callback) {
            super();
            this.callback = callback;
            this.attachShadow({mode: 'open'}).append(E('style', this.#css));
        }
        connectedCallback() {
            [this.progress, this.total] = [0, Storage('_DB')?.count || 100];
            Q('link[href$="common.css"]') && _DB.replace('V2', _DB.current).then(this.callback).catch(this.error);
        }
        attributeChangedCallback(_, __, state) {
            if (state == 'success') {
                E(this).set({'--p': 40 - 225 + '%'});
                this.progress > (Storage('_DB')?.count ?? 0) && Storage('_DB', {count: this.progress});
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
Object.assign(_DB.cache, {
    actions: {
        'part-blade': '', 'part-blade-CX': '', 'part-ratchet': '', 'part-bit': '',
        'part-meta': json => _DB.put('meta', {part: json}),
        'prod-launchers': json => _DB.put('product', {launchers: json}),
        'prod-others': json => _DB.put('product', {others: json}),
        'prod-beys': beys => _DB.put('product', [{beys}, {schedule: beys.filter(bey => bey[1].includes('BXG') || !bey[1].includes('H')).map(bey => bey[2].split(' '))}]),
    },
    filter: files => [...new O(files)].filter(([file, time]) => new Date(time) / 1000 > (Storage('_DB')?.[file] || 0)).map(([file]) => file),
});
Object.assign(_DB.store, {
    format (store) {
        if (Array.isArray(store)) return store.map(_DB.store.format);
        store = store.replace('part-', '');
        return _DB.components.includes(store) ? store.toUpperCase() : store;
    }
});
Object.assign(_DB.put, {
    parts: (parts, file) => _DB.put(file, [...new O(parts)].map(([abbr, part]) => ({...part, abbr}) ), () => _DB.indicator.update()),
});
Object.assign(_DB.get, {
    all (store) {
        let comp = /(blade|ratchet|bit)/.exec(store)?.[0];
        return new Promise(res => _DB.store(store).getAll()
            .onsuccess = ev => res(ev.target.result.map(p => comp ? {...p, comp} : p)));
    },
    parts (comps = _DB.components, toNAMES) {
        comps = [comps].flat().map(c => /^.X$/.test(c) ? `blade-${c}` : c);
        _DB.trans(comps);
        return comps.length === 1 && !toNAMES ? 
            _DB.get.all(comps[0]) : 
            Promise.all(comps.map(c => _DB.get.all(c).then(parts => [c, parts]))).then(PARTS => toNAMES ? PARTS : new O(PARTS));
    },
    names: (comps = _DB.components) => _DB.get.parts(comps, true)
        .then(PARTS => {
            let NAMES = {};
            PARTS.forEach(([comp, parts]) => comp.includes('-') ?
                NAMES.blade[comp.split('-')[1]] = parts.reduce((obj, {group, abbr, names}) => ({...obj, [group]: {...obj[group], [abbr]: names} }), {}) : 
                NAMES[comp] = parts.reduce((obj, {abbr, names}) => ({...obj, [abbr]: names}), {})
            );
            return NAMES;
        })
    ,
    meta: (comp, category) => _DB.get('meta', 'part')
        .then(meta => ({
            ...comp ? meta[comp][category] : {}, 
            ...comp ? meta[comp]._ : {},
            types: ['att', 'bal', 'def', 'sta'],
            prefixes: {bit: new KeysAsString(new O(meta.bit._.prefix).map(([k, {eng, jap}]) => [k, {eng, jap}]))}
        })
    ),
});
customElements.define('db-state', _DB.indicator);
export default _DB