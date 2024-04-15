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
        tr.Q('td', td => {
            td.custom();
            td.onclick = () => td.custom.preview();
        });
        Row.names(['eng', 'chi'], tr);
    }
    static names(lang, tr) {
        tr.Q(`td[headers=blade]`).custom.next2((td, i) => td.custom.fullname(lang[i]));
        tr.Q(`td[headers=bit]+td`).custom.fullname(lang[1] == 'chi' ? 'eng' : lang[1]);
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

HTMLTableCellElement.prototype.custom = function () { 
    this.custom = new custom(this);
    this.custom.dissect.regex.pref = new RegExp(`^[${Parts.bit.prefix}]+(?=[^a-z].*)`);
}
let custom = function(td) {
    this.td = td;
    this.next2 = (action) => [this.td.nextElementSibling, this.td.nextElementSibling?.nextElementSibling].forEach(action);

    this.dissect = (naming) => {
        let td = this.td.abbr ? this.td : $(this.td).prevAll('[abbr]')[0];
        let comp = td.headers;
        let {prop, sym} = this.dissect.exec(td.abbr, ['mode', ...comp == 'bit' && naming ? ['pref', 'dash'] : []]);
        //prop.core ? comp = 'frame' : null;
        
        return naming ? {...prop, sym, comp} : [
            //prop.core && `${prop.core}.ratchet`, 
            `${sym}.${comp}`, 
            prop.mode && `${prop.mode}.${comp}`,
            td.parentNode.more?.split(',').find(p => p.includes(comp.replace(/\d.$/, '')))
        ].filter(p => p && p[0] != '_');
    };
    Object.assign(this.dissect, {
        exec (sym, items) {return {
            prop: items.reduce((prop, item) => ({...prop, [item]: sym.match(this.regex[item])?.[0]}), {}),
            sym: items.reduce((sym, item) => sym.replace(this.regex[item], ''), sym)
        }},
        regex: {
            pref: new RegExp(`^[${Parts.bit?.prefix}]+(?=[^a-z].*)`),
            dash: /′(?:\+.)?$/,
            //core: /[\dα′_]+(?=\D)/,
            mode: /\+[^.′ ]+/
        }
    });

    this.fullname = (lang) => {
        let {sym, comp, pref, dash, core, mode} = this.dissect(true);
        let name = (comp == 'bit' && (pref || dash) ? Part.revise.name(NAMES[comp][sym], pref[0]) : NAMES[comp]?.[sym])?.[lang] ?? '';
        this.td.innerHTML = this.fullname[lang](name, comp, core) + this.fullname.add(name, dash, mode);
        //this.td.classList.toggle('small', name.length >= (Mapping.maps.oversize[lang].find(comp) || 99));
    };
    Object.assign(this.fullname, {
        eng: (name, comp, core) => (comp == 'bit' && name.length > 16 ? name.replace(' ', '<br>') : name),
        jap: (name, comp, core) => (comp == 'bit' && name.length > 8 ? name : name),
        chi: (name, comp, core) => name.replace(' ', '⬧').replace('/', ''),
        add: (name, dash, mode) => (name && dash ? '<i>′</i>' : ''),
    });

    this.preview = () => {
        Q('#popup').checked = true;
        custom.popup.innerHTML = '';
        this.preview[this.td.matches('td:first-child') ? 'image' : 'part']();
    }
    Object.assign(this.preview, {
        image () {
            custom.popup.classList.remove('catalog');
            custom.popup.replaceChildren(
                E('p', Mapping.maps.note.find(this.td.childNodes[0].textContent)),
                ...this.td.dataset.video?.split(',').map(href => E('a', {href: `//youtu.be/${href}?start=60`})) ?? [],
                ...this.image.parse(this.td, 'main').juxtapose(this.td),
                ...this.image.parse(this.td, 'more').juxtapose(this.td),
                ...this.image.parse(this.td, 'detail').juxtapose(this.td),
            );
        },
        async part () {
            custom.popup.classList.add('catalog');
            Parts._meta ??= await (await Fetch('/db/part-meta.json')).json();
    
            for (const p of this.td.custom.dissect()) {
                //new Part(await DB.get('parts', p)).catalog(true);
                let [sym, comp] = p.split('.');
                Fetch(`/db/part-${comp}.json`).then(resp => resp.json())
                .then(parts => new Part({...parts[sym], key: p}, Object.entries(parts).map(([sym, part]) => ({...part, sym}))).catalog(true));
            }
        }
    });
    Object.assign(this.preview.image, {
        parse (td, type) {
            custom.images = [];
            let no = td.childNodes[0].textContent.replace('-','');
            if (!td.dataset[type]) {
                this.format(no, type);
            } else {
                let values = {no};
                let expression = td.dataset[type].replaceAll(/\$\{.+\}/g, whole => values[whole.match(/[a-z]+/)]);
                let group = expression.match(/(?<=\().+(?=\))/)[0];
                group.split('|').forEach(s => this.format(expression.replace(`(${group})`, s), type));
            }
            return this;
        },
        format (no, type) {
            if (type == 'main')
                custom.images.push(`${no}@1`);
            else if (type == 'more')
                custom.images.push(...[1,2,3,4,5,6,7,8,9].map(n => `${no}_0${n}@1`));
            else if (type == 'detail')
                custom.images.push(`detail_${no.replace(/.+(?=\d)/, s => no.dataset?.detailUpper ? s : s.toLowerCase())}`);
        },
        src: href => /^https|\/img\//.test(href) ? href : href.length >= 15 ? 
            `https://pbs.twimg.com/media/${href}?format=png&name=large` : 
            `https://beyblade.takaratomy.co.jp/beyblade-x/lineup/_image/${href}.png`,
        juxtapose () {return [custom.images].flat().map(src => E('img', {src: this.src(src)}))},
    });
    alias(this);
}
let alias = level => {
    Object.keys(level).forEach(m => {
        Object.keys(level[m]).length && alias(level[m]);
        level[m].td = level.td;
    });
}
custom.popup = Q('label[for=popup]');