[Parts.comp, Parts.category] = [...new URLSearchParams(location.search)]?.[0] ?? [];
Parts = {
    ...Parts,
    list: () => Parts.firstly().then(Parts.listing).then(Parts.finally),
    catalog: () => Parts.firstly().then(Parts.before).then(Parts.cataloging).then(Parts.after).then(Parts.finally),
    count: group => Q('.part-result').value = document.querySelectorAll('.catalog>a:not([id^="+"]):not([hidden])').length,

    firstly: async () => {
        Q('#menu').remove();
        await Part.firstly();
    },
    before: async () => {
        Parts.meta = (await (await Fetch('/db/part-meta.json')).json())[Parts.comp][Parts.category];
        //['info', 'title', 'label'].forEach(async m => {
        //    let meta = await DB.get('meta', m);
        //    Parts.meta[m] = Parts.meta.groups.reduce((obj, g) => ({...obj, [g]: meta[g] ?? Parts.meta[m]}), {});
        //});
    },
    cataloging: async () => {
        let compare = (u, v, f = p => p) => +(f(u) > f(v)) || -(f(u) < f(v));
        let sorting = (p, q) =>
            /^MFB|BSB$/.test(p.group) && compare(q, p, p => p.group)
            || p.comp == 'ratchet' && compare(p, q, p => parseInt(p.sym.match(/\d+$/)))
            || compare(p, q, p => p.sym[0] == '+')
            || compare(p, q, p => parseInt(p.sym))
            || p.group == 'BSB' && compare(p, q, p => p.sym.match(/^..[^S]?/))
            || compare(p, q, p => p.strip().toLowerCase())
            || p.comp == 'bit' && compare(p, q, p => p.sym.match(new RegExp(`^[${Parts.bit.prefix}]`)));

        Parts.unmade = Object.entries(await (await Fetch(`/db/part-${Parts.comp}.json`)).json()).map(([sym, part]) => ({...part, key: `${sym}.${Parts.comp}`}));
        //await Promise.all(Parts.meta.groups.map(g => DB.get.parts(g)));
        Parts.unmade = Parts.unmade.flat().map((p, _, ar) => new Part(p, ar)).sort(sorting).map(p => p.prepare());
    },
    listing: async () => {
        Parts.unmade = await Promise.all(location.hash.substring(1).split(',').map(p => DB.get('parts', decodeURI(p))));
        Parts.unmade = Parts.unmade.map(p => new Part(p).prepare());
    },
    after: async () => {
        Filter();
        let hash = decodeURI(location.hash.substring(1));
        let target = Parts.unmade.find(p => p.sym == hash);
        await Q(`dl[title=group] #${(target?.group ?? hash) || Parts.meta.groups[0]}`)?.onchange(null, true);
        target?.sym && (location.hash = target.sym);
    },
    finally: async () => {
        Magnifier();
        Parts.comp || await Promise.all(Parts.unmade.map(p => p.catalog(true)));
        Q('.loading').classList.remove('loading');
        Q('dl[title=group] dt').click();
    },
    switch: async group => {
        Parts.unmade = Parts.unmade.map(p => group == 'all' || group == p.group || /^\+/.test(p.sym) ? p.catalog() : p);
        Parts.unmade = (await Promise.all(Parts.unmade)).filter(p => p);
        //if (group == 'all') return;
        location.hash = group;
        document.title = document.title.replace(/^.*?(?= ￨ )/, Parts.meta.title[group]);
        Q('details article').innerHTML = Parts.meta.info[group] ?? Parts.meta.info;
        Q('details').hidden = !(Parts.meta.info[group] ?? Parts.meta.info);
    },
}

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
    events: () => {
        Q('input[name=mag]', input => input.onchange = () => input.checked && Cookie.set('pref', {button: input.id}));
        Magnifier.range.oninput = ev => (Q('.catalog').style.fontSize = `${ev.target.value}em`) && Cookie.set('pref', {slider: ev.target.value});
        window.onresize = Magnifier.switch;
    },
    switch: () => Q('.catalog').style.fontSize = window.innerWidth > 630 ? (Magnifier.range.value = Cookie.pref?.slider || 1) + 'em' : ''
});

const Filter = function(type) {
    return this instanceof Filter ? 
        this.create(type).events().dl :
        Q('nav a').after(...['group', ...Parts.meta.filters ?? []].map(f => new Filter(f)));
};
Object.assign(Filter.prototype, {
    create: function(type) {
        let [dtText, inputs] = Filter.args()[this.type = type];
        this.dl = E('dl', 
            {title: type, classList: `part-filter ${type == 'group' ? Parts.comp : ''}`}, 
            [E('dt', dtText), ...inputs.map( i => E('dd', [E('input', {type: 'checkbox', id: i.id}), E('label', {htmlFor: i.id}, [i.text])]) )]
        );
        this.inputs = [...this.dl.querySelectorAll('input')];
        this.inputs.forEach(input => input.checked = true);
        return this;
    },
    events: function() {
        this.dl.Q('dt').onclick = async () => {
            this.inputs.forEach(input => input.checked = true);
            await Filter.filter(this.type == 'group' && 'all');
        }
        this.inputs.forEach(input => input.onchange = async (ev, check) => {
            check ? input.checked = true : this.inputs.forEach(i => i.checked = i == input);
            await Filter.filter(this.type == 'group' && input.id);
        });
        return this;
    }
});
Object.assign(Filter, {
    args: () => ({
        group: [Parts.category, Parts.meta.groups.map((g, i) => ({id: g, text: Parts.meta.labels?.[i] || g.replace(Parts.comp, '')}) )],
        type: ['類型', ['a','b','s','d'].map(t => ({id: t, text: E('img', {src: `/img/type-${t[0]}.png`})}) )],
        spin: ['迴轉', ['l','r'].map((s, i) => ({id: s, text: ['\ue01d','\ue01e'][i]}) )],
        prefix: ['變化', ['–', ...Parts.bit.prefix].map(p => ({id: p, text: p}) )],
    }),
    filter: async group => {
        group && await Parts.switch(group);
        let show = [Q('.part-filter:not([hidden])')].flat().map(dl => 
            `:is(${[dl.Q('input:checked')].flat().map(input => input.id == '–' ? Filter.normal(dl) : `[class~=${input.id}]`)})`
        ).join('');
        Q('.catalog>a[class]', a => a.hidden = !a.matches(show));
        group && Filter.toggle();
        Parts.count(group);
    },
    normal: dl => `:not(${dl.Q('input').map(input => `[class~=${input.id}]`)})`,
    toggle: () => {}
});