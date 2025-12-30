class Bey {
    constructor(abbr) {
        this.abbr = abbr;
        let [blade, ratchet, bit] = abbr.split(' ');
        [this.blade, this.ratchet, this.bit] = ratchet == '=' ?
            [new Blade(blade), new Ratchet('/'), new Bit(bit, true)] : 
            [new Blade(blade), new Ratchet(ratchet), new Bit(bit)];
    }
}
class AbsPart {
    constructor(sym, fusionORsub = false) {
        this.sym = sym;
        typeof fusionORsub == 'string' ? this.sub = fusionORsub : this.fusion = fusionORsub;
    }
    abbr = html => E('td', {
        innerHTML: html ?? this.sym.replace(/^[A-Z]$/, ' $&'), 
        abbr: this.sym, 
        headers: this.sub ?? this.constructor.name.toLowerCase(),
        classList: this.fusion ? 'fusion' : ''
    });
    none = hidden => [E('td'), E('td'), E('td', {classList: 'right'})];
}
class Blade extends AbsPart {
    constructor(sym, upperFusionORsubBlade) {
        super(sym, upperFusionORsubBlade);
        if (this.sym == '/') return;
        this.line = this.sym.includes('.') ? 'CX' : Blade.#UX.includes(sym) ? 'UX' : 'BX';
    }
    cells(fusion = this.fusion) {
        if (this.sym == '/') return this.none();
        return this.sym.includes('.') ? 
            this.sym.split('.').flatMap((p, i) => new Blade(p, Blade.sub[i]).cells()) :
            [
                this.abbr(this.sub == 'lower' ? this.sym : ''), 
                E('td', {classList: 'left'}), 
                E('td', {classList: `right${fusion ? ' fusion' : ''}`})
            ];
    }
    static sub = ['motif', 'upper', 'lower'];
    static #UX;
    static UX = async () => Blade.#UX = (await DB.get.parts('blade')).filter(p => p.group == 'UX').map(p => p.abbr);
}
class Ratchet extends AbsPart {
    constructor(sym) {
        super(sym);
    }
    cells() {
        if (this.sym == '/') return [E('td')];
        return [this.abbr()];
    }
}
class Bit extends AbsPart {
    constructor(sym, lowerFusion) {
        super(sym, lowerFusion);
    }
    cells(fusion = this.fusion) {
        if (this.sym == '/') return [E('td'), E('td')];
        return [this.abbr(), E('td')];
    }
}

class Row {
    constructor(hidden = false) {this.hidden = hidden;}
    create([code, type, abbr, ...others]) {
        if (code == 'BH') return;
        let [video, extra] = ['string', 'object'].map(t => others.find(o => typeof o == t));
        let {blade, ratchet, bit} = new Bey(abbr);
                
        this.tr = E('tr', [
            this.create.code(code, type, video), 
            blade.cells(), ratchet.cells(), bit.cells()
        ].flat(9), {
            hidden: this.hidden,
            classList: [blade.line ?? '', type],
            dataset: {abbr}
        });
        this.extra(extra ?? {});
        return Q('tbody').appendChild(this.tr);
    }
    static create = {
        code (code, type, video) {
            type.split(' ')[0] == 'RB' ? code == Row.current ? Row.RB++ : Row.RB = 1 : Row.RB = 0;
            Row.current = code;
            video ??= Q(`td[data-video]`, []).findLast(td => td.dataset.code == code)?.dataset.video;
            return E('td', 
                [code.replace(/^(?=.X-)/, ' '), ...Row.RB ? [E('s', '-'), E('sub', `0${Row.RB}`)] : []], 
                {dataset: {code, ...video ? {video} : {}}}
            );
        }
    }
    extra({coat, mode, more}) {
        coat && this.tr.style.setProperty('--coat', coat);
        mode && (this.tr.Q('td[headers=blade]').dataset.mode = JSON.stringify(mode));
        //more && (this.tr.dataset.more = Object.keys(more));
        //more && [...new O(more)].forEach(([part, column], i) => {
        //    this.tr.Q(`td:nth-child(${column})`).dataset.more = i;
        //    this.tr.style.setProperty(`--more${i}`, `'${part.split('.')[0]}'`);
        //});
    }
    any = (...tds) => this.tr.querySelector(tds.map(td => `td[abbr$=${td}]`));
    static RB = 0;
}
Object.assign(Row.prototype.create, Row.create);

class Cell {
    constructor(td) {this.td = td;}
    get text() {return Cell.text(this.td);}
    next2 = (action) => [this.td.nextElementSibling, this.td.nextElementSibling?.nextElementSibling].forEach(action);

    dissect (naming) {
        let td = this.td.abbr ? this.td : $(this.td).prevAll('[abbr]')[0];
        let mode = JSON.parse(td.dataset.mode ?? '{}');
        let [comp, line] = [td.headers, td.parentElement.classList[0]];
        let {prop, abbr} = this.dissect.exec(td.abbr, naming && this.dissect.items[comp] || []);
        //prop.core ? comp = 'frame' : null;
        
        return naming ? {...prop, abbr, comp, mode} : [
            Blade.sub.includes(comp) ? `${abbr}.${line}` : `${abbr}.${comp}`, 
            //prop.core && `${prop.core}.ratchet`, 
            //prop.mode && `${prop.mode}.${comp}`,
            //td.parentNode.more?.split(',').find(p => p.includes(comp.replace(/\d.$/, '')))
        ].filter(p => p && p[0] != '_');
    }
    static dissect = {
        items: {
            bit: ['pref']
        },
        exec (abbr, items) {return {
            prop: items.reduce((prop, item) => ({...prop, [item]: abbr.match(this.regex[item])?.[0]}), {}),
            abbr: items.reduce((abbr, item) => abbr.replace(this.regex[item], ''), abbr)
        }},
        regex: {
            pref: null,
            //dash: /′(?:\+.)?$/,
            //core: /[\dα′_]+(?=\D)/,
            //mode: /\+[^.′ ]+/
        }    
    }

    fullname (lang) {
        if (!lang) return;
        let {abbr, comp, pref, dash, core, mode} = this.dissect(true);
        let name = comp == 'bit' && (pref || dash) ? 
            Part.revise.name(NAMES[comp][abbr], pref[0]) : 
            comp != 'ratchet' && comp != 'bit' && this.td.parentElement.Q('td:nth-child(10)') ? 
                NAMES.blade[this.td.parentElement.classList[0]][comp]?.[abbr] : 
                NAMES[comp]?.[abbr];
        name = name?.[lang] ?? '';
        this.td.innerHTML = this.fullname[lang](name, comp, core) + this.fullname.add(mode[lang]);
    }
    static fullname = {
        eng: (name, comp, core) => Markup(name, 'products'),
        jap: (name, comp, core) => Cell.oversize(Markup(name, 'products'), comp, 'jap'),
        chi: (name, comp, core) => Markup(name, 'products'),
        add: (mode) => mode ? `<sub>${mode}</sub>` : ''
    }
    static oversize = (name, comp, lang) => name.length >= Cell.limit[comp]?.[lang] ? `<small>${name}</small>` : name
    static limit = {bit: {jap: 8}}

    preview () {
        Object.assign(this.preview, this._preview);
        Object.assign(this.preview.image, this.preview._image);
        this.preview.image.td = this.preview.td = this.td;
        Cell.popup.showPopover();
        Cell.popup.innerHTML = '';
        this.preview[this.td.matches('td:first-child') ? 'image' : 'part']();
    }
    _preview = {
        part: () => {
            Cell.popup.classList = 'catalog';
            this.dissect().reduce((prom, key) => prom
                .then(() => DB.get(key)).then(part => new Part(part, key).prepare()).then(part => part.catalog(true))
            , Promise.resolve())
        },
        image () {
            Cell.popup.classList = 'images';
            Cell.popup.append(
                E('p', spacing(Mapping.maps.note.find(this.td.dataset.code))),
                ...this.td.dataset.video?.split(',').map(href => E('a', {href: `//youtu.be/${href}?start=60`})) ?? [],
                ...this.image.parse('main').juxtapose(),
                ...this.image.parse('more').juxtapose(),
                ...this.image.parse('detail').juxtapose(),
            );
        },
        _image: {
            parse (type) {
                Cell.images = [];
                let code = this.td.dataset.code, lower;
                let {alias, _, ...syntax} = Mapping.maps.images.find(code);
                if (type == 'detail') {
                    let [, line, number] = /^(.+?)-(\d*)$/.exec(code);
                    lower = /^BXG-(01|04|07|14|31|32|11|18|19)$/.test(code) 
                    || line == 'BX' && parseInt(number) <= 39 
                    || line == 'UX' && parseInt(number) <= 13;
                }
                code = (alias || code).replace('-', _ ? '_' : '');
                alias || (code = code[lower ? 'toLowerCase' : 'toUpperCase']());
                if (!syntax[type]) {
                    this.format(code, type);
                } else {
                    let values = {no: code};
                    let expression = syntax[type].replaceAll(/\$\{.+\}/g, whole => values[whole.match(/[a-z]+/)]);
                    let group = expression.match(/(?<=\().+(?=\))/)?.[0];
                    group.split('|').forEach(s => this.format(expression.replace(`(${group})`, s), type));
                }
                return this;
            },
            format (code, type) {
                if (type == 'main') Cell.images.push(`${code}@1`);
                if (type == 'more') {
                    let max = Q(`td[data-code=${this.td.dataset.code}]`).length > 2 ? 18 : 9;
                    Cell.images.push(...[...Array(max)].map((_, i) => `${code}_${`${i+1}`.padStart(2, 0)}@1`));
                }
                if (type == 'detail') Cell.images.push(`detail_${code}`);
            },
            juxtapose () {return [Cell.images].flat().map(src => E('img', {src: this.src(src)}))},
            src: href => /^https|\/img\//.test(href) ? href : `https://beyblade.takaratomy.co.jp/beyblade-x/lineup/_image/${href}.png`,
        },
    }
    static text = td => td.childNodes[0].textContent.trim();
    static popup = Q('[popover]');
}
Object.assign(Cell.prototype.dissect, Cell.dissect);
Object.assign(Cell.prototype.fullname, Cell.fullname);
//Object.assign(Cell.prototype.preview, Cell.prototype._preview()());
