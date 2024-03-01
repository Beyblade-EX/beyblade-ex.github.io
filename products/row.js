class AbsPart {
    constructor(sym, fusion = false) {
        [this.sym, this.fusion] = [sym, fusion];
    }
    cells(part = `${this.sym}.${this.constructor.name.toLowerCase()}`, fusion = this.fusion) {
        if (this.sym == '/') return this.none();
        let tds = [E('td', {innerHTML: this.symHTML}), E('td', {classList: 'left'}), E('td', {classList: `right${fusion ? ' fusion' : ''}`})];
        tds[0].setAttribute('data-part', part);
        return tds;
    }
    none = hidden => [E('td', [E('s', hidden ? this.sym : 'ꕕ')]), E('td'), E('td', {classList: 'right'})];
    static number = (no, sub) => [E('td', no.replace(/^B-(?=\d\d)$/, 'B-<s>0</s>&nbsp;')), sub ? E('sub', sub) : ''];
}
class Blade extends AbsPart {
    constructor(sym, upperFusion) {
        super(sym, upperFusion);
        this.symHTML = sym;
    }
    cells(part = `${this.sym}.${this.constructor.name.toLowerCase()}`, fusion = this.fusion) {
        let tds = super.cells(part, fusion);
        tds[0].innerHTML = '';
        return tds;
    }
}
class Ratchet extends AbsPart {
    constructor(sym) {
        super(sym);
        this.symHTML = sym;
    }
}
class Bit extends AbsPart {
    constructor(sym, lowerFusion) {
        super(sym, lowerFusion);
        this.symHTML = (lowerFusion || sym.length == 1 ? '&nbsp;' : '') + sym;
    }
}

class Row {
    constructor(hidden = false) {
        this.tr = E('tr', {hidden});
    }
    static connectedCallback(tr) {
        Row.fill(['eng', 'chi'], tr);
        ['no', 'abbr', 'more'].forEach(a => tr[a] = tr.getAttribute(`data-${a}`));
        tr.Q('td', td => td.onclick = () => new Cell(td).preview());
    }
    static fill(lang, tr) {
        tr.Q(`td[data-part]:not([data-part$=ratchet])`, td =>
            new Cell(td).next2((td, i) => lang[i] && td.code(lang[i]))
        );
    }
    async create([no, type, abbr, video, extra], place) {
        let [blade, ratchet, bit] = abbr.split(' ');
        [blade, ratchet, bit] = [new Blade(blade), new Ratchet(ratchet), new Bit(bit)];

        this.tr.append(...[AbsPart.number(...no.split('.')), blade.cells(), bit.fusion ? [bit.cells(), bit.none(true)] : [ratchet.cells(), bit.cells()]].flat(9));
        this.tr.classList = [type, blade.system ?? ''].join(' ');
        this.tr.setAttribute('data-no', no.split('.')[0]);
        this.tr.setAttribute('data-abbr', abbr);
        typeof video == 'string' && this.tr.setAttribute('data-video', video);
        (typeof video == 'object' || extra) && this.extra(extra || video);

        return Q(place).appendChild(this.tr);
    }
    extra({more, coat}) {
        coat && this.tr.style.setProperty('--coat', coat);
        more && this.tr.setAttribute('data-more', Object.keys(more));
        more && Object.entries(more).forEach(([part, column], i) => {
            this.tr.Q(`td:nth-child(${column})`).setAttribute('data-more', i);
            this.tr.style.setProperty(`--more${i}`, `'${part.split('.')[0]}'`);
        });
        return this;
    }
    rare(no) {
        let color = no >= 100 && Mapping.maps.rare.find(no);
        color && this.tr.style.setProperty('--rare', color);
    }
    any = (...tds) => this.tr.querySelector(tds.map(td => `td[data-part$=${td}]`));
}

class Cell {
    constructor(td) {this.td = td;}
    next2 = action => [new Cell(this.td.nextElementSibling), new Cell(this.td.nextElementSibling.nextElementSibling)].forEach(action);
    preview = () => Preview(this.td.matches('td:first-child') ? 'image' : 'part')(this.td);
    code = lang => {
        let {sym, comp, pref, dash, core, mode} = Dissect(this.td);
        comp == 'bit' && lang == 'chi' && (lang = 'eng');
        let name = (comp == 'bit' && (pref || dash) ? Part.revise.name(NAMES[comp][sym], pref[0]) : NAMES[comp]?.[sym])?.[lang] ?? '';
        this.td.innerHTML = this[lang](name, comp, core) + this.add(name, dash, mode);
        this.td.classList.toggle('small', name.length >= (Mapping.maps.oversize[lang].find(comp) || 99));
    }
    eng = (name, comp, core) => (comp == 'bit' && name.length > 16 ? name.replace(' ', '<br>') : name);
    jap = (name, comp, core) => (comp == 'bit' && name.length > 8 ? name : name);
    chi = (name, comp, core) => name.replace(' ', '⬧').replace('/', '');
    add = (name, dash, mode) => (name && dash ? '<i>′</i>' : '');
}
const Dissect = (td, preview) => {
    td = td.matches('[data-part]') ? td : $(td).prevAll('td[data-part]')[0];
    let [sym, comp] = td.getAttribute('data-part').split('.'), items = Dissect.items(comp, preview), prop;
    ({prop, sym} = Dissect.yield(sym, items));
    //prop.core ? comp = 'frame' : null;
    
    return !preview ? {...prop, sym, comp} : [
        //prop.core && `${prop.core}.ratchet`, 
        `${sym}.${comp}`, 
        prop.mode && `${prop.mode}.${comp}`,
        td.parentNode.more?.split(',').find(p => p.includes(comp.replace(/\d.$/, '')))
    ].filter(p => p && p[0] != '_');
};
Object.assign(Dissect, {
    yield: (sym, items) => ({
        prop: items.reduce((prop, item) => ({...prop, [item]: sym.match(Dissect.regex[item])}), {}),
        sym: items.reduce((sym, item) => sym.replace(Dissect.regex[item], ''), sym)
    }),
    items: (comp, preview) => ['mode', ...comp == 'bit' && !preview ? ['pref', 'dash'] : []],
    regex: {
        pref: new RegExp(`^[${Parts.bit.prefix}]+(?=[^a-z].*)`),
        dash: /′(?:\+.)?$/,
        //core: /[\dα′_]+(?=\D)/,
        mode: /\+[^.′ ]+/
    }
});
const Preview = type => {
    Preview.popup.innerHTML = '';
    Q('#popup').checked = true;
    return Preview[type];
};
Object.assign(Preview, {
    popup: Q('label[for=popup]'),
    src: href => /^https|\/img\//.test(href) ? href : href.length >= 15 ? 
        `https://pbs.twimg.com/media/${href}?format=png&name=large` : 
        `https://beyblade.takaratomy.co.jp/beyblade-x/lineup/_image/${href}.png`,
    image: ({parentNode: tr}) => {
        Preview.popup.classList.remove('catalog');
        let video = tr.getAttribute('data-video') || $(tr).prevAll(`tr[data-video][data-no=${tr.no}]`)[0]?.getAttribute('data-video');
        Preview.popup.replaceChildren(
            E('p', Mapping.maps.note.find(tr.no)),
            ...video?.split(',').map(href => E('a', {href: `//youtu.be/${href}?start=60`})) ?? [],
            E('img', {src: Preview.src(Mapping.maps.image.find(tr.no, true))}),
            //E('details', [E('summary', '更多圖片', {onclick: Preview.more})]),
            ...[Mapping.maps.brochure.find(tr.no, true)].flat().map(src => E('img', {src: Preview.src(src)})),
        );
    },
    more: ev => {
        if (ev.target.nextSibling) return;
        let src = ev.target.parentNode.previousSibling.src;
        ev.target.parentNode.append(...[1,2,3,4,5,6,7,8,9].map(i => E('img', {src: src.replace('@1', `_0${i}@1`)})));
    },
    part: async td => {
        Preview.popup.classList.add('catalog');
        Preview.awaited ||= await Part.firstly().then(() => true);
        Parts.meta = (await (await Fetch('/db/part-meta.json')).json()).bit.軸心;

        for (const p of Dissect(td, true)) {
            //new Part(await DB.get('parts', p)).catalog(true);
            let [sym, comp] = p.split('.');
            Fetch(`/db/part-${comp}.json`).then(resp => resp.json())
            .then(parts => new Part({...parts[sym], key: p}, Object.entries(parts).map(([sym, part]) => ({...part, sym}))).catalog(true));
        }
    }
});
