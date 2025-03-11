import DB from '../include/DB.mjs'
import {Markup} from '../include/utilities.js'
import {Blade, Row, Cell} from './row.js'
let META = {};
const Table = () => {
    Table.el = Q('table');
    Table.count = Q('.prod-result');
    Table.lang = {chi: Q('#chi'), eng: Q('#eng'), jap: Q('#jap')};
    Table.bilingual = 660;
    return Table.firstly().then(Table.tabulate).then(Table.finally);
}
Object.assign(Table, {
    rows: state => [...Table.el.tBodies[0].rows].filter(tr => state == null ? true : tr.matches(state.hidden ? '[hidden],.hidden' : ':not([hidden]):not(.hidden)')),
    cells: header => Table.el.Q(header.replace(/^(.*?)(?::not\((.+?)\))?$/, (_, posi, nega) => (posi ? `[headers=${posi}]`: '[headers]') + (nega ? nega.split(',').map(h => `:not([headers=${h}])`).join('') : ''))),
    firstly () {
        Table.el.caption.classList.add('loading');
        Finder.free.disabled = Finder.free.value = 'Loading';
        Table.events();
        return Promise.all([DB.get.names(), DB.get.meta(), Blade.UX()])
            .then(([names, meta]) => {
                Cell.import(META = {...meta, names});
                Cell.prototype.dissect.regex.pref = new RegExp(`^[${META.prefixes.bit}]+(?=[^a-z].*)`);
            });
    },
    async tabulate () {
        let beys = await DB.get('product', 'beys');
        if (typeof beys == 'string') {
            beys = [...E('template', {innerHTML: beys}).content.children];
            Table.el.append(...beys);
        } else {
            beys = await beys.reduce((prev, bey) => prev.then(async arr => [...arr, await new Row().create(bey)]), Promise.resolve([]));
            //beys = beys.reduce((html, tr) => html += tr.outerHTML, '').replace(/<\/t[dr]>| (?=>)| (?:\s+)| role="row"/g, '').replaceAll('"', "'");
            //DB.put('html', [key, beys]);
        }
        Table.show.names(['eng', 'chi']);
    },
    finally () {
        Table.lang.chi.checked = true;
        $(Table.el).tablesorter();
        Table.flush();
        Table.el.caption.classList.remove('loading');
        Finder.free.disabled = Finder.free.value = '';
        if (new URLSearchParams(location.search).size)
            return Finder.find([...new URLSearchParams(location.search.replaceAll('+','%2B'))]);
        Table.show.count();
    },
    events () {
        Table.el.caption.onchange = ev => {
            Table.show.names([null, ev.target.id]);
            Table.flush();
        }
        Q('.prod-reset').onclick = Table.reset;
        Q('table button').onclick = Table.entire;
        Table.el.tBodies[0].onclick = ev => new Cell(ev.target).preview();
        onresize = () => Table.flush();
    },
    flush () {
        window.innerWidth > Table.bilingual ?
            Table.set.colspan(Table.lang.jap.checked ? 'jap' : 'both') : Table.set.colspan(Table.lang.eng.checked ? 'eng' : 'chi');
        $(Table.el).trigger('update', [false]);
    },
    show: {
        names (lang) {
            Table.cells(`:not(ratchet,bit)`).forEach(td => new Cell(td).next2((td, i) => new Cell(td).fullname(lang[i])));
            Table.cells('bit').forEach(td => new Cell(td.nextSibling).fullname(lang[1] == 'chi' ? 'eng' : lang[1]));
        },
        count: () => Table.count.value = Table.rows({hidden: false}).length,
        entire: () => Table.el.classList.remove('new')
    },
    set: {
        colspan (lang) {
            let colspan = {eng: [7, 1], jap: [1, 7], chi: [1, 7]}[lang] ?? [4, 4];
            Table.rows().forEach(tr => tr.children.length < 9 && new Cell(tr.children[1]).next2((td, i) => td.colSpan = colspan[i]))
            Table.el.classList.toggle('bilingual', lang == 'both');
            Table.lang.eng.labels[0].hidden = window.innerWidth > Table.bilingual || lang == 'both';
        },    
    },
    reset () {
        Finder.state(false);
        location.search && history.pushState('', '', '/products/');
        Filter.inputs.forEach(input => input.checked = true);
        Filter.el.classList.remove('active');
        Table.rows().forEach(tr => tr.classList.toggle('hidden', tr.hidden = false));
        Table.el.classList.add('new');
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
        Table.rows().forEach(tr => tr.classList.toggle('hidden', 
            hide.length && tr.matches(hide) || this.systems.some(i => !i.checked) && tr.matches('[data-abbr^="/"]')));
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

const Finder = () => {
    Finder.form = Q('form');
    Finder.free = Q('#free');
    Finder.events();
}
Object.assign(Finder, {
    esc: string => (string ?? '').replaceAll(' ', '').replace(/[’'ʼ´ˊ]/g, '′').replace(/([^\\])?([.*+?^${}()|[\]\\])/g, '$1\\$2'),
    find (query) {
        Finder.regexp = [], Finder.target = {more: [], parts: {}, free: ''};
        query && Finder.form.replaceChildren(...[...query].map(([comp, abbr]) => E('input', {name: comp, value: abbr, type: 'hidden'})));
        for (let where of ['free', 'form'])
            if (Finder.read(where)) 
                return Finder.process(where).build(where).search.beys(where);
    },
    read (where) {
        if (where == 'free')
            return /^\/.+\/$/.test(Finder.free.value) ? 
                Finder.regexp.push(new RegExp(Finder.free.value.replaceAll('/', ''))) : 
                Finder.target.free = Finder.esc(Finder.free.value);

        Finder.target.parts = new O(new FormData(Finder.form)).map(([k, v]) => [k, [decodeURIComponent(v)]]);
        return Object.keys(Finder.target.parts).length > 0;
    },
    process (where) {
        where == 'free' && Finder.target.free && Finder.search.parts();
        where == 'form' && Finder.target.parts.line && (
            Finder.target.parts = (({line, ...others}) => ({blade: [{[line]: others}] }))(Finder.target.parts) );
        return this;
    },
    search: {
        parts () {
            let regex = [...new O(META.prefixes.bit).map(([_, t]) => [_, new RegExp(Object.values(t).join('|').replace(/ |\|(?!.)/g,''), 'i')])];
            let prefix = regex.filter(([,t]) => t.test(Finder.target.free)).map(([p]) => p);
            Finder.target.free = Object.values(regex).reduce((str, reg) => str.replace(reg, ''), Finder.target.free);
            Finder.target.parts = Finder.search.names(META.names, Finder.target.free);
            Finder.target.parts.bit.prefix = prefix;
        },
        names: (compTOpart, typed) => 
            new O(compTOpart).map(([_, parts]) => [_, 
                [...new O(parts)].map(([abbrORline, namesORcomp]) => !namesORcomp || namesORcomp.jap ? 
                    Finder.search.match([abbrORline, namesORcomp ?? {}], typed.split('/')) && abbrORline :
                    {[abbrORline]: Finder.search.names(namesORcomp, typed)}
                ).filter(abbr => abbr)
            ])
        ,
        match: ([abbr, names], typed) => Array.isArray(typed) ? 
            typed.some(t => Finder.search.match([abbr, names], t)) : 
            new RegExp(`^${typed}$`, 'i').test(abbr) || 
                !/^[^一-龥]{1,2}(′|\\\+)?$/.test(typed) && Object.values(names).some(n => new RegExp(typed, 'i').test(Markup.sterilize(n)))
        ,
        beys (where) {
            Q('#regular.new') && Table.show.entire();
            let {true: divided, false: regexps} = Object.groupBy(Finder.regexp, r => r.constructor.name == 'O');
            Table.rows().forEach(tr => tr.hidden = !(
                Finder.target.free.length >= 2 && new RegExp(Finder.target.free, 'i').test(tr.firstChild.innerText) ||
                [...regexps ?? []].some(r => r.test(tr.dataset.abbr)) || 
                [...divided?.[0] ?? []].some(([line, regex]) => tr.classList[0] == line && regex.test(tr.dataset.abbr)) ||
                tr.dataset.more?.split(',').some(m => Finder.target.more.includes(m))
            ));
            Finder.state(true, where == 'form' && Finder.target.parts);
        }
    }, 
    build (where) {
        let s = Finder.target.parts;
        if (s.blade?.length) {
            let divided = new O(...s.blade.filter(b => typeof b == 'object'))
                .filter(([, parts]) => Object.values(parts).some(abbrs => abbrs.length > 0))
                .map(([_, parts]) => [_, new RegExp(`^${Blade.sub.map(s => parts[s]?.length ? `(?:${parts[s].join('|')})` : '.+?').join('\\.')} .+$`, 'u')])
            Finder.regexp.push(divided);
            Finder.regexp.push(new RegExp('^(' + s.blade.filter(b => typeof b == 'string').join('|') + ') .+$', 'u'));
        }
        if (s.ratchet?.length)
            Finder.regexp.push(new RegExp('^.+? (' + s.ratchet.join('|') + ') .+$'));
        if (s.bit?.length || s.bit?.prefix?.length) {
            let prefix = where == 'form' ? '' : s.bit.prefix?.length ? `[${s.bit.prefix.join('')}]` : ``;
            let bit = s.bit?.length ? `(${s.bit.join('|')})` : '[^a-z].*';
            Finder.regexp.push(new RegExp(`^.+? ${prefix}${bit}$`, 'u'));
        }
        return this;
    },
    state (searching, obake) {
        Table.el.classList.toggle('searching', searching);
        searching ? Finder.free.blur() : Finder.free.value = '';
        Table.show.count();

        let [comp, abbr] = obake ? [...new O(Finder.target.parts)][0] : [];
        abbr &&= comp == 'blade' ? META.names[comp][abbr].jap : abbr;
        comp &&= {blade: 'ブレード', ratchet: 'ラチェット', bit: 'ビット'}[comp];
        Q('a[href*=obake]').href = 'http://obakeblader.com/' + (obake && Table.count.value > 1 ? `${comp}-${abbr}/#toc2` : `?s=入手法`);
    },
    events () {
        Finder.free.onkeypress = ({keyCode}) => keyCode == 13 ? Finder.find() : '';
        Finder.free.labels[0].onclick = () => Finder.find();
    }
});
export {Table, Filter, Finder}
