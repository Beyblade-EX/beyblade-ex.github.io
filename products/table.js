
let NAMES;
const Table = async (table = Q('table')) => {
    Table.table = table;
    await Table.loading(true).fetch.meta().then(Table.fetch.beys);
    Table.sort().loading(false);
    if (new URLSearchParams(location.search).size)
        return Find.autofill(...[...new URLSearchParams(location.search.replaceAll('+','%2B'))][0]);
    Table.count().flush();
}
Object.assign(Table, {
    loading (is) {
        Table.table.Q('caption').classList.toggle('loading', is);
        Q('input:not([type])', input => input.disabled = input.value = is ? 'Loading' : '');
        return this;
    },
    fetch: {
        meta: () => Promise.all([DB.get.names(), Parts.getMeta()]).then(([names]) => NAMES = names),
        async beys () {
            //let beys = await DB.get('html', key);
            let beys = await (await Fetch('/db/prod-beys.json')).json();
            if (typeof beys == 'string') {
                beys = [...E('template', {innerHTML: beys}).content.children];
                Table.table.append(...beys);
            } else {
                beys = await beys.reduce((prev, bey) => prev.then(async arr => [...arr, await new Row().create(bey)]), Promise.resolve([]));
                //beys = beys.reduce((html, tr) => html += tr.outerHTML, '').replace(/<\/t[dr]>| (?=>)| (?:\s+)| role="row"/g, '').replaceAll('"', "'");
                //DB.put('html', [key, beys]);
            }
            beys.forEach(tr => tr && Row.connectedCallback(tr));
        }
    },
    sort () {
        $(Table.table).tablesorter();
        return this;
    },
    count () {
        Q('.prod-result').value = document.querySelectorAll(`tbody tr:not(.hidden):not([hidden])`).length;
        return this;
    },
    flush () {
        document.body.scrollWidth > 550 ?
            Table.set.colspan(Q('#jap').checked ? 'cjk' : 'both') : Table.set.colspan(Q('#eng').checked ? 'eng' : 'cjk');
        $(Table.table).trigger('update', [false]);
    },
    set: {
        colspan(lang) {
            let colspan = {eng: [1, 1], cjk: [1, 1]}[lang] ?? [1, 1];
            //Q('td[abbr$=blade],tbody td:not([abbr]):nth-child(2)', td => new Cell(td).next2(({td}, i) => td.colSpan = colspan[i]));
            Table.table.classList.toggle('bilingual', lang == 'both');
        },    
    },
    reset() {
        Find.state(false);
        location.search && history.pushState('', '', '/products/');
        Filter.inputs.forEach(input => input.checked = true);
        Q('#filter').classList.remove('active');
        Q('tr[hidden],tr.hidden', tr => tr.classList.toggle('hidden', tr.hidden = false));
        Table.table.classList.add('new');
        Table.count();
    },
    entire: () => (Table.table.classList.remove('new'), Table.flush(true)),
});

const Filter = () => {
    let type = Q('#filter label[for]').map(label => label.htmlFor);
    Q('style').innerText += type.map(id => `#${id}:not(:checked)~#filter label[for=${id}]`) + '{opacity:.5;background-color:initial !important;}';
    Q('#filter').before(...type.map(id => E('input', {id, name: 'filter', type: 'checkbox', checked: true})));
    [Filter.inputs, Filter.systems] = [Q('input[name=filter]'), Q('#RB-H~input[name=filter]')];
}
Filter.filter = () => {
    let hide = Filter.inputs.filter(i => !i.checked).map(i => `.${i.id.replace('-', '.')}`);
    Q('#filter').classList.toggle('active', hide.length);
    Q('tbody tr', tr => tr.classList.toggle('hidden', hide.length && tr.matches(hide)));
    Filter.systems.some(input => !input.checked) && Q('tr[abbr^="/"]', tr => tr.classList.add('hidden'));
    Table.count();
};

const Find = () => {
    Find.regexp = [], Find.target = {more: [], parts: {}, free: ''};
    for (const w of ['free', 'form'])
        if (Find.read(w)) 
            return Find.process(w).build(w).search.beys(w);
};
Object.assign(Find, {
    esc: string => (string ?? '').replaceAll(' ', '').replace(/[’'ʼ´ˊ]/g, '′').replace(/([^\\])?([.*+?^${}()|[\]\\])/g, '$1\\$2'),
    read(where) {
        if (where == 'free')
            return /^\/.+\/$/.test(Q('#free').value) ? 
                Find.regexp.push(new RegExp(Q('#free').value.replaceAll('/', ''))) : Find.target.free = Find.esc(Q('#free').value);

        Find.target.parts = Object.fromEntries([...new FormData(Q('form'))].map(([k, v]) => [k, [decodeURIComponent(v)]]));
        return Object.keys(Find.target.parts).length > 0;
    },
    process(where) {
        where == 'free' && Find.target.free && Find.search.parts();
        //Find.target.more.push(...Object.entries(Find.target.parts).flatMap(([comp, syms]) => syms.map(s => `${s}.${comp}`)));
        return Find;
    },
    search: {
        parts: () => {
            let terms = Object.values(Part.revise.name).map(terms => new RegExp(Object.values(terms).join('|').replace(/ |\|(?!.)/g,''), 'i'));
            let prefix = [];
            Object.keys(Part.revise.name).forEach((p, i) => {
                if (terms[i].test(Find.target.free)) {
                    prefix.push(p);
                    Find.target.free = Find.target.free.replace(terms[i], '')
                }
            });
            Object.keys(NAMES).forEach(comp => {
                let found = Find.target.free && Find.target.free.split('/').flatMap(typed => Find.search.names(comp, typed)) || [];
                Find.target.parts[comp] = [...new Set(found)];
                comp == 'bit' && (Find.target.parts[comp].prefix = prefix);
            });
        },
        names: (comp, typed) => {
            let tooShort = /^[^一-龥]{1,2}(′|\\\+)?$/.test(typed); 
            return Object.keys(NAMES[comp]).filter(sym => 
                new RegExp(`^${typed}$`, 'i').test(sym) || 
                !tooShort && Object.values(NAMES[comp][sym] ?? {}).some(n => new RegExp(typed, 'i').test(n))
            );
        },
        beys: where => {
            Q('#regular.new') && Table.entire();
            Q('tbody tr', tr => tr.hidden = !(
                Find.target.free.length >= 2 && tr.Q('td:first-child').textContent.toLowerCase().includes(Find.target.free.toLowerCase()) ||
                Find.regexp.some(regex => regex.test(tr.dataset.abbr)) || 
                tr.dataset.more?.split(',').some(m => Find.target.more.includes(m))
            ));
            Find.state(true, where == 'form' && Find.target.parts);
        }
    },
    build(where) {
        let s = Find.target.parts;
        if (s.blade?.length)
            Find.regexp.push(new RegExp('^(' + s.blade.join('|') + ') .+$', 'u'));
        if (s.ratchet?.length)
            Find.regexp.push(new RegExp('^.+? (' + s.ratchet.join('|') + ') .+$'));
        if (s.bit?.length || s.bit?.prefix?.length) {
            let prefix = where == 'form' ? '' : s.bit.prefix?.length ? `[${s.bit.prefix.join('')}]` : `[${Parts.bit.prefix}]?`;
            let bit = s.bit?.length ? `(${s.bit.join('|')})` : '[^a-z].*';
            Find.regexp.push(new RegExp(`^.+? ${prefix}${bit}$`, 'u'));
        }
        return this;
    },
    state(searching, obake) {
        Q('#regular').classList.toggle('searching', searching);
        Q('html,body', el => el.scrollTop = searching ? Q('tfoot').offsetTop : 0);
        Q('input:not([type])', input => searching ? input.blur() : input.value = '');
        Table.count(), Table.flush(true);

        let [comp, sym] = obake ? Object.entries(Find.target.parts)[0] : [];
        sym &&= comp == 'blade' ? NAMES[comp][sym].jap : sym;
        comp &&= {blade: 'ブレード', ratchet: 'ラチェット', bit: 'ビット'}[comp];
        Q('a[href*=obake]').href = 'http://obakeblader.com/' + (obake && Q('.prod-result').value > 1 ? `${comp}-${sym}/#toc2` : `?s=入手法`);
    },
    autofill(comp, sym) {
        Find.state(false);
        Q('form details').replaceChildren(...[E('input', {name: comp, value: sym})]);
        Find();
    }
});
