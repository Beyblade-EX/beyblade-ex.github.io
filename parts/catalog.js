let PARTS, Parts = {};
class Part {
    constructor(dict, key) {
        dict.key && ([dict.abbr, dict.comp] = dict.key.split('.'));
        key &&= dict.comp == 'blade' ? /.X$/.exec(key)?.[0] : null;
        Object.assign(this, {...dict, line: key});
    }
    async revise(bits) {
        if (this.comp == 'ratchet')
            return this.#revise.group();
        if (this.comp != 'bit' || this.names)
            return this;
        let [, pref, ref] = new RegExp(`^([${PARTS.prefixes.bit}]+)([^a-z].*)$`).exec(this.abbr);
        ref = bits ? bits.find(p => p.abbr == ref) : await DB.get('bit', this.strip());
        this.#revise.name(ref, pref);
        this.#revise.attr(ref, pref);
        this.#revise.stat(ref);
        this.#revise.desc(ref, pref);
        return this;
    }
    #revise = {
        name: (ref, pref) => this.names = Part.revise.name(ref, pref),
        attr: (ref, pref) => [this.group, this.attr] = [ref.group, [...this.attr ?? [], ...ref.attr, ...pref]],
        stat: ref => this.stat.length === 1 && this.stat.push(...ref.stat.slice(1)),
        desc: (ref, pref) => this.desc = [...pref].map(p => Parts.meta.prefix[p].desc).join('、') + `的【${ref.abbr}】bit${this.desc ? `，${this.desc}` : '。'}`,
        group: () => this.group = [...new O(Parts.meta.height)].find(([_, dmm]) => this.abbr.split('-')[1] >= dmm)[0]
    }
    static revise = {
        name: (ref, pref) => new O(ref?.names ?? ref).prepend(...[...pref].reverse().map(p => PARTS.prefixes.bit[p])),
    }
    
    strip = what => this.comp == 'bit' ? Part.strip(this.abbr, what) : this.abbr;
    static strip = (abbr, what) => abbr.replace(what == 'dash' ? '′' : new RegExp(`^[${PARTS.prefixes.bit}]+(?=[^′a-z])|′`, what == 'prefORdash' ? '' : 'g'), '');

    async prepare() {
        this.a = Q('.catalog').appendChild(E('a', {hidden: true}));
        await this.revise();
        return this;
    }
    async catalog(show) {
        location.pathname == '/products/' && await DB.get.meta(this.comp);
        let {abbr, comp, line, group, attr, for: For} = this;
        this.catalog.part = this.catalog.html.part = this;

        this.a ??= Q('.catalog').appendChild(E('a'));
        new E.prop(this.catalog.html(), {
            id: abbr,
            classList: [comp, line, group, ...(attr ?? []).filter(a => !/.X$/.test(a))],
            hidden: !show,
            for: For,
        }).apply(this.a);

        let query = new O(this.line ? 
            {line: this.line, [group]: abbr} : 
            {[comp]: abbr}
        );
        location.pathname == '/parts/' && (this.a.href = `/products/?${query.url()}`);
        location.pathname == '/products/' && (this.a.onclick = () => Finder?.find(query));
        return this;
    }
}
Part.prototype.catalog.html = function() {
    Q('#triangle') || Part.triangle();
    let {comp, line, group, abbr} = this.part;
    let path = [comp, line ? `${line}-${group}` : '', abbr].filter(p => p).join('/');
    return [
        E('object', {data: this.html.background()}),
        E('figure', [E('img', {src: `/img/${path}.png`})]),
        ...this.part.stat ? this.html.stat() : [],
        ...this.html.names(),
        E('p', this.part.desc ?? ''),
        this.html.icons(),
        this.html.buttons(),
        this.part.from ? E('span', this.part.from, {onclick: ev => ev.preventDefault() ?? (location.href = `/parts/?blade=一體#${ev.target.innerText}`)}) : '',
    ];
}
Object.assign(Part.prototype.catalog.html, {
    background () {
        let {comp, attr} = this.part;
        let param = [
            ['hue', getComputedStyle(document.querySelector(`.${comp.match(/^[^0-9]+/)}`)).getPropertyValue('--c')],
            [attr?.find(a => a == 'left' || a == 'right') ?? '', '']
        ];
        return `/parts/bg.svg?${new URLSearchParams(param).toString()}`;
    },
    icons () {
        let {abbr, line, group, attr} = this.part;
        let icons = new Mapping('left', '\ue01d', 'right', '\ue01e', /^(?:att|def|sta|bal)$/, t => [E('img', {src: `/img/types.svg#${t}`})]);
        ['hasbro', 'collabo'].includes(group) && (group = attr.find(a => /.X$/.test(a)));
        return E.ul([
            (line || /.X$/.test(group)) && [E('img', {src: `/img/lines.svg#${line ?? group}`})], 
            group == 'remake' && [E('img', {src: `/img/system-${/^D..$/.test(abbr) ? 'BSB' : /\d$/.test(abbr) ? 'BBB' : 'MFB'}.png`})], 
            ...(attr ?? []).map(a => icons.find(a, true))
        ]);
    },
    names () {
        let {abbr, comp, line, group, names, attr} = this.part;
        names ??= {};
        names.chi = (names.chi ?? '').split(' ');
        let children = comp != 'blade' || line == 'CX' && group == 'lower' ? 
            [E('h4', abbr.replace('-', '‒')), ...['jap','eng'].map(l => E('h5', names[l] || '', {classList: l}))] : 
            [
                Part.chi(group, attr, names.chi[0]),
                Part.chi(group, attr, names.chi[1] ?? ''),
                E('h5', {classList: 'jap', innerHTML: Markup(names.jap, 'parts')}),
                E('h5', {classList: 'eng', innerHTML: group == 'collabo' ? names.eng : Markup(names.eng, 'parts')}),
            ];
        return children;
    },
    stat () {
        let {abbr, comp, stat, date} = this.part;
        comp == 'ratchet' && stat[0] && stat.push(...abbr.split('-'));
        return [
            date ? E('strong', date) : '',
            E.dl(stat.map((s, i) => [
                Parts.meta.terms[i].replace(/(?<=[A-Z])(?=[一-龢])/, `
`),             {innerHTML: `${s}`.replace(/[+\-=]/, '<sup>$&</sup>').replace('-','−').replace('=','≈')}
            ]))
        ];
    },
    buttons () {
        let div = E('div', PARTS.types.map(t => E('svg', [E('use')], {classList: t})))
        div.Q('svg', svg => svg.setAttribute('viewBox', '-10 -10 20 10'));
        div.Q('use', use => use.setAttribute('href', '#triangle'));
        return div;
    }
});
Part.chi = (group, attr, chi) => E('h5', {
    innerHTML: Markup(chi, group == 'collabo' || attr.includes('BSB') ? '' : 'parts'), 
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
