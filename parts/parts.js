let Parts = {
    list: () => Parts.firstly().then(Parts.listing).then(Parts.finally),
    catalog: () => Parts.firstly().then(Parts.before).then(Parts.cataloging).then(Parts.after).then(Parts.finally),
    count: () => Q('.part-result').value = document.querySelectorAll('.catalog>a:not([id^="+"]):not([hidden])').length,

    async firstly () {
        Object.assign(Parts, await DB.get.meta(Parts.comp, Parts.category));
        Magnifier();
    },
    before () {
        Filter();
        new Dragging('summary', {
            click: false,
            translate: false,
            move: (drag, dragged) => Math.abs(drag.deltaY) > 50 && dragged.parentElement.classList[drag.deltaY > 0 ? 'add' : 'remove']('showing')
        });
    },
    async cataloging () {
        Parts.all = DB.get.parts(Parts.comp).then(parts => parts.map((p, _, ar) => new Part(p, ar).prepare().catalog()));
        Parts.all = await Promise.all(await Parts.all);
    },
    async listing () {
        Parts.all = await Promise.all(location.hash.substring(1).split(',').map(p => DB.get(p)));
        Parts.all = Parts.all.map(p => new Part(p).prepare().catalog(true));
    },
    after () {
        let hash = decodeURI(location.hash.substring(1));
        let target = hash && Q(`a#${hash}`);
        Parts.switch([target?.classList?.[1] || hash || Parts.meta.default].flat(), target);
        Q(`#${Storage('pref')?.sort || 'name'}`).click();
    },
    finally () {
        Q('.loading').classList.remove('loading');
    },
    async switch (groups, keep) {
        Q(`dl[title=group] input[id]`, input => input.checked = groups.includes(input.id));
        await Filter.filter();
        if (keep === false) return;
        keep === true ? (location.hash = groups[0]) : location.hash && Parts.focus();
        document.title = document.title.replace(/^.*?(?= ￨ )/, Parts.meta.title[groups] ?? Parts.meta.title);
        Q('details article').innerHTML = typeof Parts.meta.info == 'string' ? Parts.meta.info : Parts.meta.info?.[groups] ?? '';
        Q('details').hidden = !Q('details article').innerHTML;
    },
    focus () {
        Q('.target')?.classList.remove('target');
        Q(location.hash)?.classList.add('target');
        Q(location.hash)?.scrollIntoView();
    }
};
[Parts.comp, Parts.category] = [...new URLSearchParams(location.search)]?.[0] ?? [];
onhashchange = () => Parts.after();

const Magnifier = () => {
    Q('nav data').before(Magnifier.create());
    Q(`#${Storage('pref')?.button || 'mag2'}`).checked = true;
    Magnifier.knob = Q('spin-knob');
    Magnifier.events();
};
Object.assign(Magnifier, {
    create: () => E('div', {classList: 'part-mag'}, [
        E('spin-knob', [E('input', {type: 'range', min: .75, max: 2, step: 'any'}), E('i', '')]),
        ...[1,2,3].map(n => E('label', [E('input', {id: `mag${n}`, type: 'radio', name: 'mag'})]))
    ]),
    events () {
        Q('.part-mag').onchange = ({target: input}) => input.checked && Storage('pref', {button: input.id});
        Magnifier.knob.onchange = ev => ev && (Q('.catalog').style.fontSize = `${ev.target.value}em`) && Storage('pref', {knob: ev.target.value});
        setTimeout((onresize = Magnifier.switch));
    },
    switch: () => Q('.catalog').style.fontSize = innerWidth > 630 ? (Magnifier.knob.value = Storage('pref')?.knob || '1') + 'em' : ''
});

const Filter = function(type) {
    return this instanceof Filter ? 
        this.create(type).events().dl :
        Q('nav menu').after(...['group', ...Parts.meta.filters ?? []].map(f => new Filter(f)), Sorter());
};
Object.assign(Filter.prototype, {
    create (type) {
        let [dtText, inputs] = Filter.args()[this.type = type];
        this.dl = E('dl', 
            {title: type, classList: `part-filter ${type == 'group' ? Parts.comp : ''}`}, 
            [E('dt', dtText), ...inputs.map(i => E('dd', [E('label', [E('input', {type: 'checkbox', id: i.id}), i.text])] ))]
        );
        this.inputs = [...this.dl.querySelectorAll('input')];
        type != 'group' && this.inputs.forEach(input => input.checked = true);
        return this;
    },
    events () {
        this.dl.Q('dt').onclick = async () => {
            this.inputs.forEach(input => input.checked = true);
            await Filter.filter(this.type == 'group');
        }
        this.dl.onchange = async ({target: input}) => {
            this.inputs.forEach(i => i.checked = i == input);
            this.type == 'group' ? Parts.switch([input.id]) : Filter.filter(this.type == 'group');
        };
        return this;
    }
});
Object.assign(Filter, {
    args: () => ({
        group: [Parts.category, Parts.meta.groups.map((g, i) => ({id: g, text: Parts.meta.labels?.[i] || g.replace(Parts.comp, '')}) )],
        type: ['類型', Parts.types.map(t => ({id: t, text: E('img', {src: `/img/types.svg#${t}`})}) )],
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
        [E('dt', '排序'), ...inputs.map( i => E('dd', [E('label', [E('input', {type: 'radio', name: 'sort', id: i[0]}), i[1]])]) )]
    );
    dl.onchange = ({target: input}) => {
        Q('.catalog').append(...Parts.all.sort(Sorter.sort[input.id]).map(p => p.a));
        input.checked && Storage('pref', {sort: input.id});
    };
    Sorter.release(Parts.comp);
    return dl;
}
Object.assign(Sorter, {
    compare: (u, v, f = p => p) => +(f(u) > f(v)) || -(f(u) < f(v)),
    sort: {
        name: (p, q) =>
            [p.group, q.group].includes('remake') && Sorter.compare(p, q, p => p.group)
            || Sorter.compare(p, q, p => p.abbr[0] == '+')
            || Sorter.compare(p, q, p => parseInt(p.abbr))
            || Sorter.compare(p, q, p => p.strip().toLowerCase())
            || p.comp == 'bit' && Sorter.compare(p, q, p => p.abbr.length),

        weight: (p, q) => Sorter.compare(q, p, p => (w => parseInt(w) + ({'+': .2, '-': -.2}[w.at(-1)] ?? 0))(p.stat[0] || '0')),
        time: (p, q) => Sorter.compare(p, q, p => (i => i == -1 ? 999 : i)(Sorter.release().lastIndexOf(p.abbr))),
        rank: (p, q) => Sorter.compare(p, q, p => p.rank || 'Z')
    },
    release: comp => Sorter.schedule ?? DB.get('product', 'schedule').then(beys => 
        Sorter.schedule = beys.map(bey => bey[{blade: 0, ratchet: 1, bit: 2}[comp]])
    )
});
