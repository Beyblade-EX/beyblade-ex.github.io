
let NAMES, Parts;
const Table = () => Table.firstly().then(Table.tabulate).then(Table.finally);
Object.assign(Table, {
    table: Q('table'),
    firstly () {
        Table.table.Q('caption').classList.add('loading');
        Q('input:not([type])', input => input.disabled = input.value = 'Loading');
        Table.events();
        return Promise.all([DB.get.names(), DB.get.meta()]).then(([names, meta]) => (NAMES = names, Parts = meta))
            .then(() => Cell.prototype.dissect.regex.pref = new RegExp(`^[${Parts.bit.prefix}]+(?=[^a-z].*)`));
    },
    async tabulate () {
        let beys = await DB.get('product', 'beys');
        if (typeof beys == 'string') {
            beys = [...E('template', {innerHTML: beys}).content.children];
            Table.table.append(...beys);
        } else {
            beys = await beys.reduce((prev, bey) => prev.then(async arr => [...arr, await new Row().create(bey)]), Promise.resolve([]));
            //beys = beys.reduce((html, tr) => html += tr.outerHTML, '').replace(/<\/t[dr]>| (?=>)| (?:\s+)| role="row"/g, '').replaceAll('"', "'");
            //DB.put('html', [key, beys]);
        }
        Table.show.names(['eng', 'chi']);
    },
    finally () {
        Q('#chi').checked = true;
        $(Table.table).tablesorter();
        Table.table.Q('caption').classList.remove('loading');
        Q('input:not([type])', input => input.disabled = input.value = '');
        if (new URLSearchParams(location.search).size)
            return Finder.find([...new URLSearchParams(location.search.replaceAll('+','%2B'))]);
        Table.show.count();
    },
    events () {
        Q('caption').onchange = ev => ev.target.id == 'eng' ? Table.set.colspan('eng') : Table.show.names([null, ev.target.id]);
        Q('.prod-reset').onclick = Table.reset;
        Q('table button').onclick = Table.entire;
        Q('tbody').onclick = ev => ev.target.custom().preview();
        (onresize = () => Table.flush())();
    },
    flush () {
        document.body.scrollWidth > 550 ?
            Table.set.colspan(Q('#jap').checked ? 'cjk' : 'both') : Table.set.colspan(Q('#eng').checked ? 'eng' : 'cjk');
        //$(Table.table).trigger('update', [false]);
    },
    show: {
        names (lang) {
            Table.table.Q(`td[headers=blade]`, td => td.custom().next2((td, i) => td.custom().fullname(lang[i])));
            Table.table.Q(`td[headers=bit]+td`, td => td.custom().fullname(lang[1] == 'chi' ? 'eng' : lang[1]));
        },
        count: () => Q('.prod-result').value = document.querySelectorAll(`tbody tr:not(.hidden):not([hidden])`).length,
        entire: () => Table.table.classList.remove('new')
    },
    set: {
        colspan (lang) {
            let colspan = {eng: [1, 1], cjk: [1, 1]}[lang] ?? [1, 1];
            //Q('td[abbr$=blade],tbody td:not([abbr]):nth-child(2)', td => new Cell(td).next2(({td}, i) => td.colSpan = colspan[i]));
            Table.table.classList.toggle('bilingual', lang == 'both');
            Q('label:has(#eng)').hidden = lang == 'both';
        },    
    },
    reset () {
        Finder.state(false);
        location.search && history.pushState('', '', '/products/');
        Filter.inputs.forEach(input => input.checked = true);
        Q('#filter').classList.remove('active');
        Q('tr[hidden],tr.hidden', tr => tr.classList.toggle('hidden', tr.hidden = false));
        Table.table.classList.add('new');
        Table.show.count();
    },
});

const Filter = () => {
    Filter.el = Q('#filter');
    Filter.el.Q('label', label => label.append(E('input', {id: `${label.classList}`.replace(' ', '-'), type: 'checkbox', checked: true})));
    Filter.inputs = Filter.el.Q('input[id]');
    Filter.systems = Q('.system input');
    Filter.events();
}
Object.assign(Filter, {
    filter () {
        let hide = this.inputs.filter(i => !i.checked).map(i => `.${i.id.replace('-', '.')}`);
        this.el.classList.toggle('active', hide.length);
        Q('tbody tr', tr => tr.classList.toggle('hidden', 
            hide.length && tr.matches(hide) || this.systems.some(i => !i.checked) && tr.matches('[abbr^="/"]')));
        Table.show.count();
    },
    events () {
        this.systems.forEach((input, _, all) => input.addEventListener('change', () => all.forEach(i => i.checked = i == input)));
        this.el.Q('button').onclick = () => {
            this.systems.forEach(input => input.checked = true);
            this.filter();
        };
        this.el.onchange = () => this.filter();
        this.el.onmouseover = ({target}) => target.matches('label[title]') && (Q('#filter summary i').innerText = `｛${target.innerText}｝：${target.title}`);
    }
});

const Finder = () => Finder.events();
Object.assign(Finder, {
    esc: string => (string ?? '').replaceAll(' ', '').replace(/[’'ʼ´ˊ]/g, '′').replace(/([^\\])?([.*+?^${}()|[\]\\])/g, '$1\\$2'),
    find (query) {
        Finder.regexp = [], Finder.target = {more: [], parts: {}, free: ''};
        if (query) {
            Q('form').replaceChildren(...query.map(([comp, abbr]) => E('input', {name: comp, value: abbr, type: 'hidden'})));
            gtag('event', 'search', query.reduce((obj, [comp, abbr]) => ({...obj, [comp]: abbr}), {}));
        }
        for (let where of ['free', 'form'])
            if (Finder.read(where)) 
                return Finder.process(where).build(where).search.beys(where);
    },
    read (where) {
        if (where == 'free')
            return /^\/.+\/$/.test(Q('#free').value) ? 
                Finder.regexp.push(new RegExp(Q('#free').value.replaceAll('/', ''))) : Finder.target.free = Finder.esc(Q('#free').value);

        Finder.target.parts = Object.fromEntries([...new FormData(Q('form'))].map(([k, v]) => [k, [decodeURIComponent(v)]]));
        return Object.keys(Finder.target.parts).length > 0;
    },
    process (where) {
        where == 'free' && Finder.target.free && Finder.search.parts();
        //Find.target.more.push(...Object.entries(Find.target.parts).flatMap(([comp, abbrs]) => abbrs.map(s => `${s}.${comp}`)));
        return this;
    },
    search: {
        parts () {
            let regex = Object.entries(Parts.meta.prefix).map(([p, t]) => [p, new RegExp(Object.values(t).join('|').replace(/ |\|(?!.)/g,''), 'i')]);
            let prefix = regex.filter(([,t]) => t.test(Finder.target.free)).map(([p]) => p);
            Finder.target.free = Object.values(regex).reduce((str, reg) => str.replace(reg, ''), Finder.target.free);
            Object.keys(NAMES).forEach(comp => {
                let found = Finder.target.free && Finder.target.free.split('/').flatMap(typed => Finder.search.names(comp, typed)) || [];
                Finder.target.parts[comp] = [...new Set(found)];
            });
            Finder.target.parts.bit.prefix = prefix;
        },
        names: (comp, typed) =>
            Object.keys(NAMES[comp]).filter(abbr => 
                new RegExp(`^${typed}$`, 'i').test(abbr) || 
                !/^[^一-龥]{1,2}(′|\\\+)?$/.test(typed) && Object.values(NAMES[comp][abbr] ?? {}).some(n => new RegExp(typed, 'i').test(Markup.sterilize(n)))
            ),
        beys (where) {
            Q('#regular.new') && Table.show.entire();
            Q('tbody tr', tr => tr.hidden = !(
                Finder.target.free.length >= 2 && tr.Q('td:first-child').textContent.toLowerCase().includes(Finder.target.free.toLowerCase()) ||
                Finder.regexp.some(regex => regex.test(tr.dataset.abbr)) || 
                tr.dataset.more?.split(',').some(m => Finder.target.more.includes(m))
            ));
            Finder.state(true, where == 'form' && Finder.target.parts);
        }
    }, 
    build (where) {
        let s = Finder.target.parts;
        if (s.blade?.length)
            Finder.regexp.push(new RegExp('^(' + s.blade.join('|') + ') .+$', 'u'));
        if (s.ratchet?.length)
            Finder.regexp.push(new RegExp('^.+? (' + s.ratchet.join('|') + ') .+$'));
        if (s.bit?.length || s.bit?.prefix?.length) {
            let prefix = where == 'form' ? '' : s.bit.prefix?.length ? `[${s.bit.prefix.join('')}]` : `[${Parts.bit.prefix}]?`;
            let bit = s.bit?.length ? `(${s.bit.join('|')})` : '[^a-z].*';
            Finder.regexp.push(new RegExp(`^.+? ${prefix}${bit}$`, 'u'));
        }
        return this;
    },
    state (searching, obake) {
        Table.table.classList.toggle('searching', searching);
        Q('html,body', el => el.scrollTop = searching ? Q('tfoot').offsetTop : 0);
        Q('input:not([type])', input => searching ? input.blur() : input.value = '');
        Table.show.count();

        let [comp, abbr] = obake ? Object.entries(Finder.target.parts)[0] : [];
        abbr &&= comp == 'blade' ? NAMES[comp][abbr].jap : abbr;
        comp &&= {blade: 'ブレード', ratchet: 'ラチェット', bit: 'ビット'}[comp];
        Q('a[href*=obake]').href = 'http://obakeblader.com/' + (obake && Q('.prod-result').value > 1 ? `${comp}-${abbr}/#toc2` : `?s=入手法`);
    },
    events () {
        Q('input:not([type])', input => input.onkeypress = ({keyCode}) => keyCode == 13 ? Finder.find() : '');
        Q('label[for=free]').onclick = () => Finder.find();
    }
});
