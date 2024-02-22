
let NAMES;
const Table = async () => {
    Table.loading(true);
    NAMES = await DB.get.names();
    await Promise.all([Table.fetch('prod-new')]);//.then(() => Table.fetch('prod-old'))]);
    $('#regular').tablesorter();
    Table.RB();
    Table.loading(false);
    if (new URLSearchParams(location.search).size)
        return Find.autofill([...new URLSearchParams(location.search.replaceAll('+','%2B'))]);
    Table.count(), Table.flush();
}
Object.assign(Table, {
    limit: 'BX-100',
    loading(is) {
        Q('#regular caption').classList.toggle('loading', is);
        Q('input:not([type])', input => input.disabled = input.value = is ? 'Loading' : '');
    },
    async fetch(key, tbody = '#regular tbody') {
        //let beys = await DB.get('html', key);
        let beys = await (await Fetch('/db/prod-new.json')).json();
        if (typeof beys == 'string') {
            beys = [...E('template', {innerHTML: beys}).content.children];
            Q(tbody).append(...beys);
        } else {
            beys = await beys.reduce((prev, bey) => prev.then(async arr => [...arr, await new Row().create(bey, tbody)]), Promise.resolve([]));
            //DB.put('html', [key, Table.trim(beys)]);
        }
        beys.forEach(tr => (tr.classList.toggle('old', key == 'prod-old'), Row.connectedCallback(tr)));
    },
    RB() {
        Q('tr.RB:not(.H)', tr => {
            let index = 1, bey = tr;
            while (bey.matches('.RB')) {
                bey.Q('td:first-child').append('\u00a0', E('sub', ` 0${index++}`));
                bey = bey.nextSibling;
            }
        })
    },
    flush(update = false) {
        document.body.scrollWidth > 400 ?
            Table.colspan(Q('#jap').checked ? 'cjk' : 'both') : Table.colspan(Q('#eng').checked ? 'eng' : 'cjk');
        $('#regular').trigger('update', [false]);
    },
    colspan(lang) {
        let colspan = {eng: [5, 1], cjk: [1, 5]}[lang] ?? [2, 4];
        Q('td[data-part$=blade],tbody td:not([data-part]):nth-child(2)', td => new Cell(td).next2(({td}, i) => td.colSpan = colspan[i]));
        Q('table', table => table.classList.toggle('bilingual', lang == 'both'));
    },
    reset() {
        Find.state(false);
        location.search && history.pushState('', '', '/products/');
        Filter.inputs.forEach(input => input.checked = true);
        Q('#filter').classList.remove('active');
        Q('tr[hidden],tr.hidden', tr => tr.classList.toggle('hidden', tr.hidden = false));
        Q('#regular').classList.add('new');
        Table.count();
    },
    entire: () => (Q('#regular').classList.remove('new'), Table.flush(true)),
    count: () => Q('.prod-result').value = document.querySelectorAll(`tbody tr:not(.hidden):not([hidden])`).length,
    trim: rows => rows.reduce((html, tr) => html += tr.outerHTML, '').replace(/<\/t[dr]>|\s(?=>)|\s(?:\s+)/g, '').replaceAll('"', "'"),
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
    Filter.systems.some(input => !input.checked) && Q('tr[data-abbr^="/"]', tr => tr.classList.add('hidden'));
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
                Find.target.free.length >= 2 && tr.no.toLowerCase().includes(Find.target.free.toLowerCase()) ||
                Find.regexp.some(regex => regex.test(tr.abbr)) || 
                tr.more?.split(',').some(m => Find.target.more.includes(m))
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
    autofill(pairs) {
        Find.state(false);
        Q('form details').replaceChildren(...pairs.map(([name, value]) => E('input', {name, value})));
        Find();
    }
});
