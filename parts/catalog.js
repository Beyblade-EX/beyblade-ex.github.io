let Parts = {bit: {prefix: 'GHL'}};
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
        ref = this.array.find(p => p.sym == ref);//await DB.get('parts', this.strip() + '.bit');
        this.revise.name(ref, pref);
        this.revise.attr(ref, pref);
        this.revise.stat(ref);
        this.revise.desc(ref, pref);
        return this;
    }
    revise = {
        name: (ref, pref) => this.names = Part.revise.name(ref, pref),
        attr: (ref, pref) => [this.group, this.attr] = [ref.group, [...this.attr ?? [], ...ref.attr, ...pref]],
        stat: ref => this.stat.length === 1 && this.stat.push(...ref.stat.slice(1)),
        desc: (ref, pref) => this.desc = Part.revise.desc(ref, pref, this.desc ?? '')
    }
    static revise = {
        name: (ref, pref) => [...pref].reverse().reduce((names, p) => concat(Part.revise.name[p], names), ref?.names ?? ref),
        desc: (ref, pref, desc) => [...pref].map(p => Part.revise.desc[p]).join('、') + `的【${ref.sym}】bit${desc ? `，${desc}` : '。'}`
    }
    
    strip = what => Part.strip(this.sym, what);
    static strip = (sym, what) => sym.replace(what == 'dash' ? '′' : new RegExp(`^[${Parts.bit.prefix}]+(?=[^′a-z])|′`, what == 'prefORdash' ? '' : 'g'), '');

    prepare() {
        this.a = Q('.catalog').appendChild(E('a', {hidden: true}));
        return this;
    }
    async catalog(show) {
        let {sym, comp, group, attr, for: For} = await this.revision();
        this.catalog.part = this.catalog.html.part = this;

        this.a ??= Q('.catalog').appendChild(E('a'));
        this.a.append(...this.catalog.html(this));
        Object.assign(this.a, {
            id: sym,
            className: [group, ...(attr ?? [])].filter(c => c).join(' '),
            hidden: !show,
            for: For,
        });
        location.pathname == '/parts/' && !/^pP|[lrd]αe$/.test(sym) ? this.a.href = `/products/?${comp}=${encodeURIComponent(sym)}` : null;
        location.pathname == '/products/' ? this.a.onclick = () => Find?.autofill(this.comp, this.sym) : null;
    }
    static firstly = async () => {
        return Promise.resolve();
        let lists = !Parts.comp || Parts.comp == 'bit' ? Parts.derived.map(g => DB.get.keys(g).then(syms => Parts[g] = syms.map(sym => Part.strip(sym.split('.')[0], 'prefORdash')))) : [];
        await Promise.all(lists);
    }
}
Object.assign(Part.revise.name, {
    H: {eng: 'High ', jap: 'ハイ'},
    L: {eng: 'Low ', jap: 'ロー'},
    G: {eng: 'Gear ', jap: 'ギア'}
});
Object.assign(Part.revise.desc, {H: `高度提升 10 `, L: `高度下降 10 `, G: `齒部延長`});

Part.prototype.catalog.html = function() {
    return [
        E('embed', {src: this.html.background()}),
        this.html.names(),
        this.html.icons(),
        this.part.stat ? this.html.stat() : '', this.html.image(),
        E('p', this.part.desc ?? '')
    ];
}
Object.assign(Part.prototype.catalog.html, {
    background: function() {
        return `/parts/bg.svg?hue=${getComputedStyle(Q(`.${this.part.comp.match(/^[^0-9]+/)}`)).getPropertyValue('--c')}`;
    },
    symbol: function() {
        let {sym} = this.part;
        return E('h4', sym);
    },
    icons: function() {
        let {group, attr} = this.part;
        let icons = new Mapping('l', '\ue01d', 'r', '\ue01e', /^[abds]$/, t => [E('img', {src: `/img/type-${t}.png`})]);
        return E('ul', [
            /^BSB|MFB|BBB$/.test(group) ? E('li', [E('img', {src: `/img/system-${group}.png`})]) : '', 
            ...(attr ?? []).map(a => E('li', icons.find(a, true))), 
        ]);
    },
    names: function() {
        let {sym, comp, names} = this.part;
        names ??= {};''
        names.chi = (names.chi ?? '').split(' ');
        let children = comp != 'blade' ? 
            [this.symbol(), ...['chi','jap','eng'].map(l => E('h5', names[l], {classList: l}))] : 
            [
                E('div', {classList: 'chi'}, [
                    this.names.chi(names.chi[0]),
                    ...names.chi[1] ? [E('span'),
                    this.names.chi(names.chi[1])] : [],
                ]),
                E('h5', {classList: 'jap'}, names.jap),
                E('h5', {classList: 'eng', innerHTML: names.eng.replace(/^.+(?=[A-Z])/, '<span>$&</span>')}),
            ];
        return E('div', children, {classList: `names${['CbDr'].includes(sym) ? ' reverse' : ''}`});
    },
    image: function() {
        let {sym, comp} = this.part;
        return E('figure', [E('img', {src: `/img/${comp}/${sym}.png`})]);
    },
    stat: function() {
        let {sym, stat, comp} = this.part;
        comp == 'ratchet' && stat.push(...sym.split('-'));
        return E('dl', stat.flatMap((s, i) => [
            E('dt', Parts.meta.terms[i]), 
            E('dd', {innerHTML: `${s}`.replace(/[+\-=]/, '<sup>$&</sup>').replace('-','−').replace('=','≈')})
        ]));
    }
});
Part.prototype.catalog.html.names.chi = chi => E('h5', {
    innerHTML: chi.replace(...chi.includes('/') ? [/(.+)\/(.+)/, '<span>$1</span><br>$2'] : [/(?<=..)/, '<br>']), 
    classList: chi.length > 4 ? 'oversize' : ''
});