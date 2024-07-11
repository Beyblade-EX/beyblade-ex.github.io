let NAMES;
const App = () => {
    [1,2,3,4,5].forEach(t => (App.create('#deck', t), App.create('#tier', t)));
    App.popup = Q('[popover]');
    App.events();
    App.act.events();
    Storage('cached') && Q('aside').classList.remove('first');
    Storage('cached', new Date().getTime());
};
App.create = (where, title) => {
    let deck = Q(`${where} template`).content.cloneNode(true);
    deck.Q('h2').title = title;
    Q(where).append(deck);
}
App.load = {
    saved () {
        return DB.get('user', 'pref').then(re => Q('#lang').value = re?.lang ?? 'tw')
        .then(() => Promise.all([
            DB.get('user', '#deck').then(re => re?.forEach((deck, i) => 
                Q(`#deck article:nth-of-type(${i+1}) bey-x`, (bey, j) => bey.init(deck[j]))
            )),
            DB.get('user', '#tier').then(re => Object.entries(re ?? {}).forEach(([tier, beys]) =>
                Q(`#tier h2[title='${tier}']+section`).append(...beys.map(([c, p]) => [new Bey({[c]: p}, {collapse: true}), '']).flat())
            ))
        ]));
    },
    parts () {
        let bits = ['sta', 'bal', 'att', 'def'];
        let sorter = {
            blade: (p, q) => Sorter.sort.weight(p, q),
            ratchet: (p, q) => parseInt(p.abbr.split('-')[1]) - parseInt(q.abbr.split('-')[1]),
            bit: (p, q) => bits.indexOf(p.attr[0]) - bits.indexOf(q.attr[0])
        };
        return DB.get.names('blade')
        .then(names => (NAMES = names) && DB.get.parts())
        .then(async PARTS => ({...PARTS, bit: await Promise.all(PARTS.bit.map((p, _, ar) => new Part(p).revise(ar)))}))
        .then(PARTS => Object.entries(PARTS).forEach(([comp, parts]) => 
            Q(`aside .${comp}`).append(...parts
                .filter(p => comp != 'blade' || comp == 'blade' && p.names.chi)
                .sort(sorter[comp]).map((p, i) => E('li', [new Bey({[comp]: p.abbr}, {attr: p.attr, order: i, collapse: true})]) 
            )))
        );
    }
};
App.act = (param) => ({
    'export-image': App.act.export.image,
    'export-text': App.act.export.text,
    'delete-deck': App.act.delete,
    'expand-deck': App.act.expand
})[Q('button.selected')?.id]?.(param);
Object.assign(App.act, {
    export: {
        image (n) {
            App.act.popup('image');
            let target = Q(n ? `#deck article:nth-of-type(${n})` : '#tier');
            target.style.background = 'black';
            //!n && (target.style.minWidth = '35rem') && (target.style.maxWidth = '40rem');
            setTimeout(() => html2canvas(target, {scale: 2}).then(canvas => {
                E('a', {
                    href: canvas.toDataURL("image/png"),
                    download: n ? `DECK${n}.png` : 'TIER.png'
                }).click(); 
                target.removeAttribute('style');
            }).catch(er => console.error(er) ?? (App.popup.textContent = er)), 100);
        },
        text (n) {
            App.act.popup('text');
            let text = n ?
                Q(`#deck article:nth-of-type(${n}) bey-x`).map(bey => bey.name).join('\n') :
                Q('#tier article').filter(ar => ar.Q('bey-x'))
                .map(ar => `T${ar.Q('h2').title}：`+ [...ar.querySelectorAll('bey-x')].map(bey => bey.name).join('、')).join('\n');
            App.popup.Q('blockquote').innerText = text;
            navigator.clipboard.writeText(text);
        },
    },
    delete () {
        Q('#deck bey-x:is([blade],[ratchet],[bit])', bey => bey.classList.add('deletable'));
        Q('#deck').addEventListener('click', ev => {
            ev.target.tagName == 'BEY-X' && ev.target.delete();
            Q('#deck bey-x', bey => bey.classList.remove('deletable'));
            App.act.reset();
        }, {once: true})
    },
    expand () {
        Q('bey-x[expand]') ? Q('#deck bey-x', bey => bey.removeAttribute('expand')) : Q('#deck bey-x', bey => bey.setAttribute('expand', true));
        App.act.reset(!Q('#deck bey-x[expand]'));
    },
    popup (t) {
        App.popup.Q(`.${t}`).hidden = false;
        App.popup.showPopover();
    },
    reset (button = true) {
        App.popup.Q('p:not([hidden])')?.setAttribute('hidden', '');
        Q('bey-x:is(.deletable,.selected)', el => el.classList.remove('selected', 'deletable'));
        button && Q('button.selected')?.classList.remove('selected');
        Q('.actioning')?.classList.remove('actioning');
    },
    events () {
        App.popup.addEventListener('click', ev => App.act.reset(ev));
        Q('nav').onclick = ev => {
            if (ev.target.tagName != 'BUTTON') return;
            if (ev.target.classList.contains('selected')) return App.act.reset();
            ev.target.classList.add('selected');
            ev.target.id.includes('-deck') || location.hash == '#tier' ? 
                App.act() : Q(location.hash).classList.toggle('actioning');
        };
        Q('h2', h2 => h2.onclick = () => App.act(h2.title));
    },
});
Object.assign(App, {
    save (hash) {
        if (!App.interacted) return;
        hash == '#deck' && DB.put('user', {'#deck': Q('#deck article').map(ar => ar.Q('bey-x').map(bey => bey.string))});
        hash == '#tier' && DB.put('user', {'#tier': Q('#tier article').reduce((obj, ar) => 
            ({...obj, [ar.Q('h2').title]: [...ar.querySelectorAll('bey-x')].map(bey => bey.abbr[0])}), {})
        });
        hash || DB.put('user', {pref: {lang: Q('#lang').value}});
    },
    switch () {
        Q('main', main => main.hidden = !main.matches(location.hash ||= '#deck'));
        Q('.deck,.tier', el => el.hidden = !el.classList.contains(location.hash.substring(1)));

        location.hash == '#tier' && App.count();
    },
    count (part) {
        (part ? [part] : Q('aside bey-x')).map(bey => {
            let [[p, c]] = bey.abbr;
            let tiered = Q(`#tier bey-x[${p}='${c}']`);
            Q(`aside bey-x[${p}='${c}']`).used = tiered ? tiered.length ?? 1 : 0;
        });
    },
    events () {
        document.onpointerdown = ev => (App.interacted = true) && ev.target.closest('aside')?.classList.remove('first');
        onhashchange = App.switch;
        Q('#lang').onchange = ev => {
            ev && Bey.lang(ev.target.value);
            App.save();
        }
        this.events.observe = () => (observer => 
            Q('article,section', el => observer.observe(el, { subtree: true, childList: true, attributeFilter: Bey.observedAttributes }))
        )(new MutationObserver(() => App.save(location.hash)));

        new Dragging('#deck', {
            hold: {to: bey => bey.abbr.length && (location.href = `/parts/#${bey.abbr.map(([comp, abbr]) => `${abbr}.${comp}`)}`)},
            drop: {
                targets: 'main bey-x',
                when: ev => ev.target.classList.contains('selected')
            },
            lift: drop => drop.to.swap()
        });
        new Dragging('#tier', {
            hold: {
                to: pressed => pressed.select(),
                redispatch: true
            },
            drop: {
                targets: ['#tier bey-x', '#tier section', '#tier'],
                when: ev => ev.target.classList.contains('selected')
            },
            lift: {
                drop: [
                    drop => drop.to.swap(), 
                    drop => drop.to.transfer(), 
                    (_, dragged) => {
                        dragged.remove();
                        App.count(dragged);
                    }
                ]
            }
        });
        new Dragging('aside', {
            hold: {
                to: pressed => pressed.select(),
                redispatch: true
            },
            scroll: {
                what: 'ul',
                when: ev => !ev.target.matches('.selected'),
            },
            drop: {
                targets: ['#deck bey-x', '#tier section'],
                when: ev => ev.target.matches('.selected')
            },
            press: {
                drop () {
                    let list = Q('aside .selecting');
                    list.style.setProperty('--scrolled', list.scrollLeft);
                    Q('aside').classList.add('customizing');
                }
            },
            move: {
                scroll (drag) {
                    let aside = Q('aside'), slided = parseInt(getComputedStyle(aside).getPropertyValue('--slided') || 0);
                    if (!drag.triggered && Math.abs(drag.deltaY) > 50 && Math.atan(Math.abs(drag.deltaY/drag.deltaX)) > Math.PI/3  
                        && (slided === 0 && drag.deltaY < 0 || slided === 1 || slided === 2 && drag.deltaY > 0)) {
                        drag.triggered = true; 
                        slided -= Math.sign(drag.deltaY);
                        aside.style.setProperty('--slided', slided);
                        Dragging.class.temp(aside, 'sliding');
                        Dragging.class.switch(`aside ul:nth-child(${slided+1})`, 'selecting');
                    }
                },
            },
            lift: {
                scroll (drag) {
                    clearTimeout(drag.timer);
                    drag.triggered = false;
                },
                drop: Object.assign([
                    (drop, dragged, targeted) => {
                        drop.to.return();
                        targeted.setAttribute(...dragged.abbr[0]);
                        gtag('event', 'customize', {deck: dragged.abbr[0][1]});
                    },
                    (drop, dragged) => {
                        drop.to.clone();
                        App.count(dragged);
                        gtag('event', 'customize', {tier: dragged.abbr[0][1]});
                    },
                ], {all: () => setTimeout(() => Q('.customizing')?.classList.remove('customizing'), 500)})
            }
        });
    },
});
