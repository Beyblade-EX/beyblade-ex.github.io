class AbsPart {
    constructor(sym, fusion = false) {
        [this.sym, this.fusion] = [sym, fusion];
    }
    abbr = html => E('td', {
        innerHTML: html ?? this.sym.replace(/^[A-Z]$/, '&nbsp;$&'), 
        abbr: this.sym, 
        headers: this.constructor.name.toLowerCase()
    });
    none = hidden => [E('td', [E('s', hidden ? this.sym : 'ꕕ')]), E('td'), E('td', {classList: 'right'})];
    static number = (no, sub) => [E('td', {innerHTML: no.replace(/_X-(?=\d{2})/, 'X-&nbsp;')}), sub ? E('sub', sub) : ''];
}
class Blade extends AbsPart {
    constructor(sym, upperFusion) {
        super(sym, upperFusion);
    }
    cells(fusion = this.fusion) {
        if (this.sym == '/') return this.none();
        let tds = [this.abbr(''), E('td', {classList: 'left'}), E('td', {classList: `right${fusion ? ' fusion' : ''}`})];
        return tds;
    }
}
class Ratchet extends AbsPart {
    constructor(sym) {
        super(sym);
    }
    cells() {
        if (this.sym == '/') return [E('td', [E('s', hidden ? this.sym : 'ꕕ')])];
        let tds = [this.abbr()];
        return tds;
    }
}
class Bit extends AbsPart {
    constructor(sym, lowerFusion) {
        super(sym, lowerFusion);
    }
    cells(fusion = this.fusion) {
        if (this.sym == '/') return [E('td', [E('s', hidden ? this.sym : 'ꕕ')])];
        let tds = [this.abbr(), E('td', fusion ? {classList: fusion} : null)];
        return tds;
    }
}

class Row {
    constructor(hidden = false) {
        this.tr = E('tr', {hidden});
    }
    static connectedCallback(tr) {
        Row.names(['eng', 'chi'], tr);
        tr.onclick = ev => Preview(ev.target);
    }
    static names(lang, tr) {
        new Cell(tr.Q(`td[headers=blade]`)).next2((td, i) => lang[i] && td.name(lang[i]))
        new Cell(tr.Q(`td[headers=bit]+td`)).name(lang[1] == 'chi' ? 'eng' : lang[1]);
    }
    async create([no, type, abbr, ...others], place) {
        if (no == 'BH') return this.tr = null;
        let [blade, ratchet, bit] = abbr.split(' ');
        [blade, ratchet, bit] = [new Blade(blade), new Ratchet(ratchet), new Bit(bit)];
        
        let video = others.find(o => typeof o == 'string') ?? [Q(`td[data-video]`)].flat().findLast(td => td?.childNodes[0].textContent == no)?.dataset.video;
        
        this.tr.append(...[this.number(no, video ? {video} : {}), blade.cells(), bit.fusion ? [bit.cells(), bit.none(true)] : [ratchet.cells(), bit.cells()]].flat(9));
        this.tr.classList = [type, blade.system ?? ''].join(' ');
        this.tr.dataset.abbr = abbr;
        
        this.extra(others.find(o => typeof o == 'object') ?? {});
        return Q(place).appendChild(this.tr);
    }
    number(number, obj) {
        let [no, sub] = number.split('.');
        let td = E('td', {innerHTML: no.replace(/_X-(?=\d{2})/, 'X-&nbsp;')}, [sub ? E('sub', sub) : '']);
        Object.assign(td.dataset, {...Mapping.maps.images.find(no), ...obj});
        return td;
    }
    extra({more, coat}) {
        coat && this.tr.style.setProperty('--coat', coat);
        more && (this.tr.dataset.more = Object.keys(more));
        more && Object.entries(more).forEach(([part, column], i) => {
            this.tr.Q(`td:nth-child(${column})`).dataset.more = i;
            this.tr.style.setProperty(`--more${i}`, `'${part.split('.')[0]}'`);
        });
        return this;
    }
    any = (...tds) => this.tr.querySelector(tds.map(td => `td[abbr$=${td}]`));
}

class Cell {
    constructor(td) {this.td = td;}
    next2 = action => [new Cell(this.td.nextElementSibling), new Cell(this.td.nextElementSibling.nextElementSibling)].forEach(action);
    name = lang => {
        let {sym, comp, pref, dash, core, mode} = Dissect(this.td);
        let name = (comp == 'bit' && (pref || dash) ? Part.revise.name(NAMES[comp][sym], pref[0]) : NAMES[comp]?.[sym])?.[lang] ?? '';
        this.td.innerHTML = this[lang](name, comp, core) + this.add(name, dash, mode);
        //this.td.classList.toggle('small', name.length >= (Mapping.maps.oversize[lang].find(comp) || 99));
    }
    eng = (name, comp, core) => (comp == 'bit' && name.length > 16 ? name.replace(' ', '<br>') : name);
    jap = (name, comp, core) => (comp == 'bit' && name.length > 8 ? name : name);
    chi = (name, comp, core) => name.replace(' ', '⬧').replace('/', '');
    add = (name, dash, mode) => (name && dash ? '<i>′</i>' : '');
}
const Dissect = (td, preview) => {
    Dissect.regex.pref = new RegExp(`^[${Parts.bit.prefix}]+(?=[^a-z].*)`);

    td.abbr || (td = $(td).prevAll('[abbr]')[0]);
    let [sym, comp] = [td.abbr, td.headers], items = Dissect.items(comp, preview), prop;
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
        pref: new RegExp(`^[${Parts.bit?.prefix}]+(?=[^a-z].*)`),
        dash: /′(?:\+.)?$/,
        //core: /[\dα′_]+(?=\D)/,
        mode: /\+[^.′ ]+/
    }
});
const Preview = td => {
    Preview.td = td;
    Preview.popup.innerHTML = '';
    Q('#popup').checked = true;
    Preview[td.matches('td:first-child') ? 'image' : 'part']();
};
Object.assign(Preview, {
    popup: Q('label[for=popup]'),
    image: () => {
        Preview.popup.classList.remove('catalog');
        Preview.popup.replaceChildren(
            E('p', Mapping.maps.note.find(Preview.td.childNodes[0].textContent)),
            ...Preview.td.dataset.video?.split(',').map(href => E('a', {href: `//youtu.be/${href}?start=60`})) ?? [],
            ...Preview.image.parse('main').juxtapose(),
            ...Preview.image.parse('more').juxtapose(),
            ...Preview.image.parse('detail').juxtapose(),
        );
    },
    part: async () => {
        Preview.popup.classList.add('catalog');
        Parts._meta ??= await (await Fetch('/db/part-meta.json')).json();

        for (const p of Dissect(Preview.td, true)) {
            //new Part(await DB.get('parts', p)).catalog(true);
            let [sym, comp] = p.split('.');
            Fetch(`/db/part-${comp}.json`).then(resp => resp.json())
            .then(parts => new Part({...parts[sym], key: p}, Object.entries(parts).map(([sym, part]) => ({...part, sym}))).catalog(true));
        }
    }
});
Object.assign(Preview.image, {
    parse (type) {
        Preview._images = [];
        let no = Preview.td.childNodes[0].textContent.replace('-','');
        if (!Preview.td.dataset[type]) {
            Preview.image.format(no, type);
        } else {
            let values = {no};
            let expression = Preview.td.dataset[type].replaceAll(/\$\{.+\}/g, whole => values[whole.match(/[a-z]+/)]);
            let group = expression.match(/(?<=\().+(?=\))/)[0];
            group.split('|').forEach(s => Preview.image.format(expression.replace(`(${group})`, s), type));
        }
        return this;
    },
    format (no, type) {
        if (type == 'main')
            Preview._images.push(`${no}@1`);
        else if (type == 'more')
            Preview._images.push(...[1,2,3,4,5,6,7,8,9].map(n => `${no}_0${n}@1`));
        else if (type == 'detail')
            Preview._images.push(`detail_${no.replace(/.+(?=\d)/, s => no.dataset?.detailUpper ? s : s.toLowerCase())}`);
    },
    src: href => /^https|\/img\//.test(href) ? href : href.length >= 15 ? 
        `https://pbs.twimg.com/media/${href}?format=png&name=large` : 
        `https://beyblade.takaratomy.co.jp/beyblade-x/lineup/_image/${href}.png`,
    juxtapose: () => [Preview._images].flat().map(src => E('img', {src: Preview.image.src(src)})),
});
let custom = HTMLTableCellElement.prototype.custom = function () { 
    this.custom.td = this; 
    Object.keys(this.custom).forEach(k => this.custom[k].td ??= this);
}
Object.assign(custom, {
    dissect (preview) {
        let td = this.td.abbr ? this.td : $(this.td).prevAll('[abbr]')[0];
        let [sym, comp] = [td.abbr, td.headers];
        let items = this.dissect.items(comp, preview), prop;
        ({prop, sym} = this.dissect.yield(sym, items));
        //prop.core ? comp = 'frame' : null;
        
        return !preview ? {...prop, sym, comp} : [
            //prop.core && `${prop.core}.ratchet`, 
            `${sym}.${comp}`, 
            prop.mode && `${prop.mode}.${comp}`,
            td.parentNode.more?.split(',').find(p => p.includes(comp.replace(/\d.$/, '')))
        ].filter(p => p && p[0] != '_');
    },
    name () {
    },
    preview () {
    }
});
Object.assign(custom.dissect, {
    yield: (sym, items) => ({
        prop: items.reduce((prop, item) => ({...prop, [item]: sym.match(Dissect.regex[item])?.[0]}), {}),
        sym: items.reduce((sym, item) => sym.replace(Dissect.regex[item], ''), sym)
    }),
    items: (comp, preview) => ['mode', ...comp == 'bit' && !preview ? ['pref', 'dash'] : []],
});
Object.assign(custom.preview, {
});