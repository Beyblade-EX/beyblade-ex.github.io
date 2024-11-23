class AbsPart {
    constructor(sym, fusionORsub = false) {
        this.sym = sym;
        typeof fusionORsub == 'string' ? this.sub = fusionORsub : this.fusion = fusionORsub;
    }
    abbr = html => E('td', {
        innerHTML: html ?? this.sym.replace(/^[A-Z]$/, ' $&'), 
        abbr: this.sym, 
        headers: this.sub ?? this.constructor.name.toLowerCase()
    });
    none = hidden => [E('td'), E('td'), E('td', {classList: 'right'})];
}
class Blade extends AbsPart {
    constructor(sym, upperFusionORsubBlade) {
        super(sym, upperFusionORsubBlade);
        if (this.sym == '/') return;
        this.system = this.sym.includes('-') ? 'CX' : Blade.#UX.includes(sym) ? 'UX' : 'BX';
    }
    cells(fusion = this.fusion) {
        if (this.sym == '/') return this.none();
        return this.sym.includes('-') ? 
            this.sym.split('-').flatMap((p, i) => new Blade(p, Blade.#sub[i]).cells()) :
            [this.abbr(''), E('td', {classList: 'left'}), E('td', {classList: `right${fusion ? ' fusion' : ''}`})];
    }
    static #sub = ['upper', 'lower'];
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
        return [this.abbr(), E('td', fusion ? {classList: fusion} : null)];
    }
}

class Row {
    constructor(hidden = false) {this.hidden = hidden;}
    create([code, type, abbr, ...others]) {
        if (code == 'BH') return;
        let [video, extra] = ['string', 'object'].map(t => others.find(o => typeof o == t));
        let [blade, ratchet, bit] = abbr.split(' ');
        [blade, ratchet, bit] = [new Blade(blade), new Ratchet(ratchet), new Bit(bit)];
                
        this.tr = E('tr', [
            this.create.code(code, type, video), 
            blade.cells(), 
            bit.fusion ? [bit.cells(), bit.none(true)] : [ratchet.cells(), bit.cells()]
        ].flat(9), {
            hidden: this.hidden,
            classList: [type, blade.system ?? ''].join(' '),
            dataset: {abbr}
        });
        this.extra(extra ?? {});
        return Q('tbody').appendChild(this.tr);
    }
    static create = {
        code (code, type, video) {
            type.split(' ')[0] == 'RB' ? code == Row.current ? Row.RB++ : Row.RB = 1 : Row.RB = 0;
            Row.current = code;
            video ??= [Q(`td[data-video]`)].flat().findLast(td => td?.custom().text == code)?.dataset.video;
            return E('td', 
                [code.replace(/^(?=.X-)/, ' '), ...Row.RB ? [E('s', '-'), E('sub', `0${Row.RB}`)] : []], 
                {dataset: {...Mapping.maps.images.find(code), ...video ? {video} : {}}}
            );
        }
    }
    extra({more, coat}) {
        coat && this.tr.style.setProperty('--coat', coat);
        more && (this.tr.dataset.more = Object.keys(more));
        more && Object.entries(more).forEach(([part, column], i) => {
            this.tr.Q(`td:nth-child(${column})`).dataset.more = i;
            this.tr.style.setProperty(`--more${i}`, `'${part.split('.')[0]}'`);
        });
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
        let comp = td.headers;
        let {prop, abbr} = this.dissect.exec(td.abbr, naming && this.dissect.items[comp] || []);
        //prop.core ? comp = 'frame' : null;
        
        return naming ? {...prop, abbr, comp} : [
            `${abbr}.${comp}`, 
            //prop.core && `${prop.core}.ratchet`, 
            //prop.mode && `${prop.mode}.${comp}`,
            //td.parentNode.more?.split(',').find(p => p.includes(comp.replace(/\d.$/, '')))
        ].filter(p => p && p[0] != '_');
    }
    static dissect = {
        items: {
            bit: ['pref']
        },
        exec (abbr, items) {return{
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
        let name = (comp == 'bit' && (pref || dash) ? Part.revise.name(NAMES[comp][abbr], pref[0]) : NAMES[comp]?.[abbr])?.[lang] ?? '';
        this.td.innerHTML = this.fullname[lang](name, comp, core) + this.fullname.add(name, dash, mode);
    }
    static fullname = {
        eng: (name, comp, core) => Markup(name, 'products'),
        jap: (name, comp, core) => Markup(name, 'products'),
        chi: (name, comp, core) => Markup(name, 'products'),
        add: (name, dash, mode) => (name && dash ? '<i>′</i>' : ''),
    }

    preview () {
        Object.assign(this.preview, this._preview);
        Object.assign(this.preview.image, this.preview._image);
        this.preview.image.td = this.preview.td = this.td;
        Cell.popup.showPopover();
        Cell.popup.innerHTML = '';
        this.preview[this.td.matches('td:first-child') ? 'image' : 'part']();
    }
    _preview = {
        part: async () => {
            Cell.popup.classList = 'catalog';
            this.dissect().reduce((prom, part) => prom.then(() => DB.get(part)).then(p => new Part(p).catalog(true)), Promise.resolve())
        },
        image () {
            Cell.popup.classList = 'images';
            Cell.popup.append(
                E('p', Mapping.maps.note.find(Cell.text(this.td))),
                ...this.td.dataset.video?.split(',').map(href => E('a', {href: `//youtu.be/${href}?start=60`})) ?? [],
                ...this.image.parse('main').juxtapose(),
                ...this.image.parse('more').juxtapose(),
                ...this.image.parse('detail').juxtapose(),
            );
        },
        _image: {
            parse (type) {
                Cell.images = [];
                let no = (this.td.dataset.switch || Cell.text(this.td)).replace('-', this.td.dataset.underscore ? '_' : '');
                if (!this.td.dataset[type]) {
                    this.format(no, type, this.td.dataset.detailUpper);
                } else {
                    let values = {no};
                    let expression = this.td.dataset[type].replaceAll(/\$\{.+\}/g, whole => values[whole.match(/[a-z]+/)]);
                    let group = expression.match(/(?<=\().+(?=\))/)?.[0];
                    group.split('|').forEach(s => this.format(expression.replace(`(${group})`, s), type));
                }
                return this;
            },
            format (no, type, upper) {
                type == 'main' && Cell.images.push(`${no}@1`);
                type == 'more' && Cell.images.push(...[...Array(9)].map((_, i) => `${no}_${`${i+1}`.padStart(2, 0)}@1`));
                type == 'detail' && Cell.images.push(`detail_${no.replace(/.+(?=\d)/, s => upper ? s : s.toLowerCase())}`);
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

HTMLTableCellElement.prototype.custom = function () {return this._custom ??= new Cell(this);}
