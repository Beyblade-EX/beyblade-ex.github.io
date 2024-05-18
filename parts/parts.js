Parts = {
    ...typeof Parts == 'object' ? Parts : {},
    list: () => Parts.firstly().then(Parts.listing).then(Parts.finally),
    catalog: () => Parts.firstly().then(Parts.before).then(Parts.cataloging).then(Parts.after).then(Parts.finally),
    count: group => Q('.part-result').value = document.querySelectorAll('.catalog>a:not([id^="+"]):not([hidden])').length,

    async firstly () {
        Q('#menu').remove();
        await Parts.getMeta();
        Filter();
    },
    async before () {
        //['info', 'title', 'label'].forEach(async m => {
        //    let meta = await DB.get('meta', m);
        //    Parts.meta[m] = Parts.meta.groups.reduce((obj, g) => ({...obj, [g]: meta[g] ?? Parts.meta[m]}), {});
        //});
    },
    async cataloging () {
        Parts.all = Object.entries(await (await Fetch(`/db/part-${Parts.comp}.json`)).json()).map(([sym, part]) => ({...part, key: `${sym}.${Parts.comp}`}));
        //await Promise.all(Parts.meta.groups.map(g => DB.get.parts(g)));
        Parts.all = await Promise.all(Parts.all.flat().map((p, _, ar) => new Part(p, ar)).map(p => p.prepare().catalog()));
    },
    async listing () {
        Parts.all = await Promise.all(location.hash.substring(1).split(',').map(p => DB.get('parts', decodeURI(p))));
        Parts.all = Parts.all.map(p => new Part(p).prepare().catalog());
    },
    after () {
        Q('#name').click();
        let hash = decodeURI(location.hash.substring(1));
        let target = hash && Q(`a#${hash}`);
        Parts.switch([target?.classList?.[1] || hash || Parts.meta.default].flat(), target);
        Cookie.sort && Q(`#${Cookie.sort}`).click();
    },
    finally () {
        Magnifier();
        Q('.loading').classList.remove('loading');
    },
    async switch (groups, keep) {
        groups.forEach(g => Q(`dl #${g}`).checked = true);
        await Filter.filter();
        if (keep === false) return;
        keep === true ? (location.hash = groups[0]) : location.hash && Parts.focus();
        document.title = document.title.replace(/^.*?(?= ￨ )/, Parts.meta.title[groups] ?? Parts.meta.title);
        Q('details article').innerHTML = Parts.meta.info[groups] ?? Parts.meta.info;
        Q('details').hidden = !(Parts.meta.info[groups] ?? Parts.meta.info);
    },
    focus () {
        Q(location.hash)?.classList.add('target');
        Q(location.hash)?.scrollIntoView();
    }
};
[Parts.comp, Parts.category] = [...new URLSearchParams(location.search)]?.[0] ?? [];
const Magnifier = () => {
    Q('nav').before(...Magnifier.inputs());
    Q('nav data').before(Magnifier.create());
    Q(`#${Cookie.pref?.button || 'mag2'}`).checked = true;
    Magnifier.range = Q('input[type=range]');
    Magnifier.events();
    Magnifier.switch();
};
Object.assign(Magnifier, {
    inputs: () => [1,2,3].map(n => E('input', {id: `mag${n}`, type: 'radio', name: 'mag'})),
    create: () => E('div', {classList: 'part-mag'}, [
        E('input', {type: 'range', min: .75, max: 2, step: .05}),
        ...[1,2,3].map(n => E('label', {htmlFor: `mag${n}`}))
    ]),
    events () {
        Q('input[name=mag]', input => input.onchange = () => input.checked && Cookie.set('pref', {button: input.id}));
        Magnifier.range.oninput = ev => (Q('.catalog').style.fontSize = `${ev.target.value}em`) && Cookie.set('pref', {slider: ev.target.value});
        window.onresize = Magnifier.switch;
    },
    switch: () => Q('.catalog').style.fontSize = window.innerWidth > 630 ? (Magnifier.range.value = Cookie.pref?.slider || 1) + 'em' : ''
});

const Filter = function(type) {
    return this instanceof Filter ? 
        this.create(type).events().dl :
        Q('nav a').after(...['group', ...Parts.meta.filters ?? []].map(f => new Filter(f)), Sorter());
};
Object.assign(Filter.prototype, {
    create (type) {
        let [dtText, inputs] = Filter.args()[this.type = type];
        this.dl = E('dl', 
            {title: type, classList: `part-filter ${type == 'group' ? Parts.comp : ''}`}, 
            [E('dt', dtText), ...inputs.map( i => E('dd', [E('input', {type: 'checkbox', id: i.id}), E('label', {htmlFor: i.id}, [i.text])]) )]
        );
        this.inputs = [...this.dl.querySelectorAll('input')];
        type != 'group' && this.inputs.forEach(input => input.checked = true);
        return this;
    },
    events () {
        this.dl.Q('dt').onclick = async () => {
            this.inputs.forEach(input => input.checked = true);
            await Filter.filter(this.type == 'group' && 'all');
        }
        this.inputs.forEach(input => input.onchange = async () => {
            this.inputs.forEach(i => i.checked = i == input);
            Parts.switch([input.id], this.type == 'group');
        });
        return this;
    }
});
Object.assign(Filter, {
    args: () => ({
        group: [Parts.category, Parts.meta.groups.map((g, i) => ({id: g, text: Parts.meta.labels?.[i] || g.replace(Parts.comp, '')}) )],
        type: ['類型', Parts.types.map(t => ({id: t, text: E('img', {src: `/img/type-${t}.png`})}) )],
        spin: ['迴轉', ['left','right'].map((s, i) => ({id: s, text: ['\ue01d','\ue01e'][i]}) )],
        prefix: ['變化', ['–', ...Parts.bit?.prefix ?? []].map(p => ({id: p, text: p}) )],
    }),
    filter: async group => {
        let show = [Q('.part-filter[title]:not([hidden])')].flat().map(dl => 
            `:is(${[dl.Q('input:checked')].flat().map(input => input.id == '–' ? Filter.normal(dl) : `.${input.id}`)})`
        ).join('');
        Q('.catalog>a[class]', a => a.hidden = !a.matches(show));
        Parts.count(group);
    },
    normal: dl => `:not(${dl.Q('input').map(input => `[class~=${input.id}]`)})`,
});
const Sorter = () => {
    let inputs = [['name', '\ue034'], /*['rank', '\ue037'],*/ ['weight', '\ue036'], ['time', '\ue035']];
    let dl = E('dl', 
        {classList: `part-sorter`}, 
        [E('dt', '排序'), ...inputs.map( i => E('dd', [E('input', {type: 'radio', name: 'sort', id: i[0]}), E('label', {htmlFor: i[0]}, i[1])]) )]
    );
    dl.Q('input', input => input.onchange = () => {
        Q('.catalog').append(...Parts.all.sort(Sorter.sort[input.id]).map(p => p.a));
        input.checked && Cookie.set('sort', input.id);
    });
    return dl;
}
Object.assign(Sorter, {
    compare: (u, v, f = p => p) => +(f(u) > f(v)) || -(f(u) < f(v)),
    sort: {
        name: (p, q) =>
            (/^MFB|BSB$/.test(p.group) || /^MFB|BSB$/.test(q.group)) && Sorter.compare(q, p, p => p.group)
            || Sorter.compare(p, q, p => p.sym[0] == '+')
            || Sorter.compare(p, q, p => parseInt(p.sym))
            || Sorter.compare(p, q, p => p.strip().toLowerCase())
            || p.comp == 'bit' && Sorter.compare(p, q, p => p.sym.match(new RegExp(`^[${Parts.bit.prefix}]`))),

        weight: (p, q) => Sorter.compare(q, p, p => (w => parseInt(w) + ({'+': .2, '-': -.2}[w.at(-1)] ?? 0))(p.stat[0] || '0')),
        time: (p, q) => Sorter.compare(p, q, p => Sorter.schedule(p.comp).lastIndexOf(p.sym)),
        rank: (p, q) => Sorter.compare(p, q, p => p.rank || 'Z')
    },
    schedule: comp => Sorter._schedule ?? Fetch('/db/prod-beys.json').then(resp => resp.json())
        .then(products => Sorter._schedule = products.map(([_1, _2, bey]) => bey.split(' ')[{blade: 0, ratchet: 1, bit: 2}[comp]]))
});
Sorter.schedule(Parts.comp);
