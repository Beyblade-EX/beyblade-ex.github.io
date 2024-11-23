const concat = (...objs) => objs.reduce((summed, o, i) => i === 0 ? summed : Object.fromEntries(Object.entries(summed).map(([k, v]) => [k, v += o[k] ?? ''])), objs[0]);
class Part {
    constructor(dict) {
        dict.key && ([dict.abbr, dict.comp] = dict.key.split('.'));
        Object.assign(this, dict);
    }
    async revise(bits) {
        if (this.comp == 'ratchet') {
            this.#revise.group();
            return this;
        }
        if (this.comp != 'bit' || this.names)
            return this;
        Parts.bit?.prefix ?? Object.assign(Parts, await DB.get.meta());
        let [, pref, ref] = new RegExp(`^([${Parts.bit.prefix}]+)([^a-z].*)$`).exec(this.abbr);
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
        group: () => this.group = Object.entries(Parts.meta.height).find(([_, dmm]) => this.abbr.split('-')[1] >= dmm)[0]
    }
    static revise = {
        name: (ref, pref) => [...pref].reverse().reduce((names, p) => concat(Parts.meta.prefix[p], names), ref?.names ?? ref),
    }
    
    strip = what => this.comp == 'bit' ? Part.strip(this.abbr, what) : this.abbr;
    static strip = (abbr, what) => abbr.replace(what == 'dash' ? '′' : new RegExp(`^[${Parts.bit.prefix}]+(?=[^′a-z])|′`, what == 'prefORdash' ? '' : 'g'), '');

    prepare() {
        this.a = Q('.catalog').appendChild(E('a', {hidden: true}));
        return this;
    }
    async catalog(show) {
        location.pathname == '/products/' && (Parts = await DB.get.meta(this.comp));
        let {abbr, comp, group, attr, for: For} = await this.revise();
        this.catalog.part = this.catalog.html.part = this;

        this.a ??= Q('.catalog').appendChild(E('a'));
        this.a.append(...this.catalog.html());
        Object.assign(this.a, {
            id: abbr,
            className: [comp, group, ...(attr ?? [])].filter(c => c).join(' '),
            hidden: !show,
            for: For,
        });
        location.pathname == '/parts/' && (this.a.href = `/products/?${comp}=${encodeURIComponent(abbr)}`);
        location.pathname == '/products/' && (this.a.onclick = () => Finder?.find([[comp, abbr]]));
        return this;
    }
}

Part.prototype.catalog.html = function() {
    Q('#triangle') || Part.triangle();
    return [
        E('object', {data: this.html.background()}),
        E('figure', [E('img', {src: `/img/${this.part.comp}/${this.part.abbr}.png`})]),
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
        let spin = attr?.includes('left') ? '&left' : attr?.includes('right') ? '&right' : '';
        return `/parts/bg.svg?hue=${getComputedStyle(document.querySelector(`.${comp.match(/^[^0-9]+/)}`)).getPropertyValue('--c')}${spin}`;
    },
    icons () {
        let {abbr, group, attr} = this.part;
        let icons = new Mapping('left', '\ue01d', 'right', '\ue01e', /^.{3}$/, t => [E('img', {src: `/img/types.svg#${t}`})]);
        return E('ul', [
            /X$/.test(group) ? E('li', [E('img', {src: `/img/lines.svg#${group}`})]) : '', 
            group == 'remake' ? E('li', [E('img', {src: `/img/system-${/^D..$/.test(abbr) ? 'BSB' : /\d$/.test(abbr) ? 'BBB' : 'MFB'}.png`})]) : '', 
            ...(attr ?? []).map(a => E('li', icons.find(a, true))), 
        ]);
    },
    names () {
        let {abbr, comp, names} = this.part;
        names ??= {};
        names.chi = (names.chi ?? '').split(' ');
        let children = comp != 'blade' ? 
            [E('h4', abbr.replace('-', '‒')), ...['jap','eng'].map(l => E('h5', names[l], {classList: l}))] : 
            [
                Part.chi(abbr, names.chi[0]),
                Part.chi(abbr, names.chi[1] ?? ''),
                E('h5', {classList: 'jap', innerHTML: Markup(names.jap, 'parts')}),
                E('h5', {classList: 'eng', innerHTML: Markup(names.eng, 'parts')}),
            ];
        return children;
    },
    stat () {
        let {abbr, comp, stat, limited} = this.part;
        comp == 'ratchet' && stat[0] && stat.push(...abbr.split('-'));
        return [
            E('strong', limited ? 'L' : ''),
            E('dl', stat.flatMap((s, i) => [
                E('dt', Parts.meta.terms[i].replace(/(?<=[A-Z])(?=[一-龢])/, `
`)), 
                E('dd', {innerHTML: `${s}`.replace(/[+\-=]/, '<sup>$&</sup>').replace('-','−').replace('=','≈')})
            ]))
        ];
    },
    buttons () {
        let div = E('div', Parts.types.map(t => E('svg', [E('use')], {classList: t})))
        div.Q('svg', svg => svg.setAttribute('viewBox', '-10 -10 20 10'));
        div.Q('use', use => use.setAttribute('href', '#triangle'));
        return div;
    }
});
Part.chi = (abbr, chi) => E('h5', {
    innerHTML: /^D[ZRGC]/.test(abbr) ? chi.replace(' ', ' ') : 
        Markup(chi, 'parts'), 
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
