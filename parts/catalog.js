const concat = (...objs) => objs.reduce((summed, o, i) => i === 0 ? summed : Object.fromEntries(Object.entries(summed).map(([k, v]) => [k, v += o[k] ?? ''])), objs[0]);
class Part {
    constructor(dict, array) {this.array = array;
        [dict.sym, dict.comp] = dict.key.split('.');
        Object.assign(this, dict);
    }
    async revision() {
        if (this.comp != 'bit' || this.names)
            return this;
        let [, pref, ref] = new RegExp(`^([${Parts.bit.prefix}]+)([^a-z].*)$`).exec(this.sym);
        Parts.ref ??= {};
        Parts.ref[ref] ??= this.array.find(p => p.sym == ref);//await DB.get('parts', this.strip() + '.bit');
        this.revise.name(Parts.ref[ref], pref);
        this.revise.attr(Parts.ref[ref], pref);
        this.revise.stat(Parts.ref[ref]);
        this.revise.desc(Parts.ref[ref], pref);
        return this;
    }
    revise = {
        name: (ref, pref) => this.names = Part.revise.name(ref, pref),
        attr: (ref, pref) => [this.group, this.attr] = [ref.group, [...this.attr ?? [], ...ref.attr, ...pref]],
        stat: ref => this.stat.length === 1 && this.stat.push(...ref.stat.slice(1)),
        desc: (ref, pref) => this.desc = [...pref].map(p => Parts.meta.prefix[p].desc).join('、') + `的【${ref.sym}】bit${this.desc ? `，${this.desc}` : '。'}`
    }
    static revise = {
        name: (ref, pref) => [...pref].reverse().reduce((names, p) => concat(Parts.meta.prefix[p], names), ref?.names ?? ref),
    }
    
    strip = what => Parts.comp == 'bit' ? Part.strip(this.sym, what) : this.sym;
    static strip = (sym, what) => sym.replace(what == 'dash' ? '′' : new RegExp(`^[${Parts.bit.prefix}]+(?=[^′a-z])|′`, what == 'prefORdash' ? '' : 'g'), '');

    prepare() {
        this.a = Q('.catalog').appendChild(E('a', {hidden: true}));
        return this;
    }
    async catalog(show) {
        let {sym, comp, group, attr, for: For} = await this.revision();
        this.catalog.part = this.catalog.html.part = this;

        this.a ??= Q('.catalog').appendChild(E('a'));
        this.a.append(...this.catalog.html());
        Object.assign(this.a, {
            id: sym,
            className: [comp, group, ...(attr ?? [])].filter(c => c).join(' '),
            hidden: !show,
            for: For,
        });
        location.pathname == '/parts/' ? this.a.href = `/products/?${comp}=${encodeURIComponent(sym)}` : null;
        location.pathname == '/products/' ? this.a.onclick = () => Finder?.find([[comp, sym]]) : null;
        return this;
    }
}
let Parts = {
    types: ['att', 'bal', 'def', 'sta'],
    getMeta: async () => {
        let meta = await (await Fetch('/db/part-meta.json')).json();
        Parts.meta = Parts.comp ? {...meta[Parts.comp][Parts.category], ...meta[Parts.comp]._} : meta.bit._;
        (!Parts.comp || Parts.comp == 'bit') && (Parts.bit = {prefix: Object.keys(Parts.meta.prefix).join('')});
    }
};

Part.prototype.catalog.html = function() {
    Q('#triangle') || Part.triangle();
    return [
        E('object', {data: this.html.background()}),
        E('figure', [E('img', {src: `/img/${this.part.comp}/${this.part.sym}.png`})]),
        this.html.icons(),
        ...this.part.stat ? this.html.stat() : [],
        ...this.html.names(),
        E('p', this.part.desc ?? ''),
        this.html.buttons()
    ];
}
Object.assign(Part.prototype.catalog.html, {
    background () {
        let {comp, attr} = this.part;
        let spin = attr?.includes('left') ? '&left' : attr?.includes('right') ? '&right' : '';
        return `/parts/bg.svg?hue=${getComputedStyle(document.querySelector(`.${comp.match(/^[^0-9]+/)}`)).getPropertyValue('--c')}${spin}`;
    },
    icons () {
        let {sym, group, attr} = this.part;
        let icons = new Mapping('left', '\ue01d', 'right', '\ue01e', /^.{3}$/, t => [E('img', {src: `/img/type-${t}.png`})]);
        return E('ul', [
            /X$/.test(group) ? E('li', [E('img', {src: `/img/line.svg#${group}`})]) : '', 
            group == 'remake' ? E('li', [E('img', {src: `/img/system-${/^D..$/.test(sym) ? 'BSB' : /\d$/.test(sym) ? 'BBB' : 'MFB'}.png`})]) : '', 
            ...(attr ?? []).map(a => E('li', icons.find(a, true))), 
        ]);
    },
    names () {
        let {sym, group, comp, names} = this.part;
        names ??= {};
        names.chi = (names.chi ?? '').split(' ');
        let children = comp != 'blade' ? 
            [E('h4', sym.replace('-', '‒')), ...['jap','eng'].map(l => E('h5', names[l], {classList: l}))] : 
            [
                Part.chi(sym, group, names.chi[0]),
                Part.chi(sym, group, names.chi[1] ?? ''),
                E('h5', {classList: 'jap'}, names.jap),
                E('h5', {classList: 'eng', innerHTML: names.eng.replace(/^.+(?=[A-Z])/, '<span>$&</span>')}),
            ];
        return children;
    },
    stat () {
        let {sym, comp, rank, stat} = this.part;
        comp == 'ratchet' && stat[0] && stat.push(...sym.split('-'));
        return [
            E('strong', rank),
            E('dl', stat.flatMap((s, i) => [
                E('dt', Parts.meta.terms[i].replace(/(?<=[A-Z])(?=[一-龢])/, `
`)), 
                E('dd', {innerHTML: `${s}`.replace(/[+\-=]/, '<sup>$&</sup>').replace('-','−').replace('=','≈')})
            ]))
        ];
    },
    buttons () {
        let menu = E('menu', Parts.types.map(t => E('li', [E('svg', [E('use')])], {classList: t})))
        menu.Q('svg', svg => svg.setAttribute('viewBox', '-10 -10 20 10'));
        menu.Q('use', use => use.setAttribute('href', '#triangle'));
        return menu;
    }
});
Part.chi = (sym, group, chi) => E('h5', {
    innerHTML: ['BSB','MFB','BBB'].includes(group) ? chi.replace(' ', ' ') : 
        chi.replace(...chi.includes('/') ? [/(.+)\/(.+)/, '<span>$1</span>$2'] : 
            ['CbDr'].includes(sym) ? [/(..)$/, '<span>$1</span>'] : [/^(..)/, '<span>$1</span>']
        ), 
    classList: 'chi'
});

Part.triangle = () => {
    let [r1, r2] = [.75, 1];
    let cornerAdjustX = r1 / Math.tan(Math.PI / 8);
    let cornerAdjustY = cornerAdjustX * Math.SQRT1_2;
    let topAdjust = r2 / Math.SQRT2;
    document.body.append(E('svg', [E('defs', [E('path', {id: 'triangle'})])]));
    Q('#triangle').setAttribute('d',
        `M ${cornerAdjustX-10},-10 A ${r1},${r1},0,0,0,${cornerAdjustY-10},${cornerAdjustY-10}
        L -${topAdjust},-${topAdjust} A ${r2},${r2},0,0,0,${topAdjust},-${topAdjust}
        L ${10-cornerAdjustY},${cornerAdjustY-10} A ${r1},${r1},0,0,0,${10-cornerAdjustX},-10 Z`
    );
};
