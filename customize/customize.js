const App = () => {
    let create = (where, title) => {
        let deck = Q(`${where} template`).content.cloneNode(true);
        deck.Q('h2').title = title;
        Q(where).append(deck);
    }
    [1,2,3,4,5].forEach(t => create('#deck', t));
    [1,2,3,4,5].forEach(t => create('#tier div', t));
    App.events();
};
Object.assign(App, {
    load: {
        saved () {
            DB.get('user', 'pref').then(re => re && (Q('#lang').value = re.lang));
            return Promise.all([
                DB.get('user', '#deck').then(re => re?.forEach((deck, i) => 
                    Q(`#deck article:nth-of-type(${i+1}) bey-x`, (bey, j) => bey.init(deck[j]))
                )),
                DB.get('user', '#tier').then(re => Object.entries(re ?? {}).forEach(([tier, beys]) =>
                    Q(`#tier h2[title='${tier}']+section`).append(...beys.map(([c, p]) => [new Bey({[c]: p}), ' ']).flat())
                ))
            ]);
        },
        parts () {
            let bits = ['round', 'flat', 'sharp', 'multi'];
            let sorter = {
                blade: (p, q) => Sorter.sort.weight(p, q),
                ratchet: (p, q) => parseInt(p.abbr.split('-')[1]) - parseInt(q.abbr.split('-')[1]),
                bit: (p, q) => bits.indexOf(p.group) - bits.indexOf(q.group)
            };
            return Parts.getMeta().then(() => Promise.all(['blade', 'ratchet', 'bit'].map(c => 
                DB.get.parts(c)
                .then(parts => c == 'bit' ? Promise.all(parts.map(p => new Part(p).revise())) : parts)
                .then(parts => Q(`aside .${c}`).append(...parts
                    .filter(p => c != 'blade' || c == 'blade' && p.names.chi)
                    .sort(sorter[c]).map((p, i) => E('li', [new Bey({[c]: p.abbr}, {attr: p.attr, order: i})]) 
                )))
            )));
        }
    },
    save (hash) {
        if (!App.interacted) return;
        hash == '#deck' && DB.put('user', {'#deck': Q('#deck article').map(ar => ar.Q('bey-x').map(bey => bey.string))});
        hash == '#tier' && DB.put('user', {'#tier': Q('#tier article').reduce((obj, ar) => 
            ({...obj, [ar.Q('h2').title]: [...ar.querySelectorAll('bey-x')].map(bey => bey.abbr[0])}),{})
        });
        hash || DB.put('user', {pref: {lang: Q('#lang').value}});
    },
    switch () {
        Q('main', main => main.hidden = !main.matches(location.hash ||= '#deck'));
        Object.assign(Q('nav a:nth-of-type(2)'), {
            href: location.hash == '#deck' ? '#tier' : '#deck',
            innerHTML: `<span>${location.hash == '#deck' ? 'TIER' : 'DECK'}</span>`
        });
        Q('.deck', el => el.style.visibility = location.hash != '#deck' ? 'hidden' : 'visible');

        if (location.hash == '#tier')
            return [Q('#tier bey-x')].flat().forEach(({abbr: [[p, c]]}) => Q(`aside bey-x[${p}='${c}']`).used = true);
        [Q('bey-x.used')].flat().forEach(bey => bey && (bey.used = false));
        App.interacted && Q('ul', App.aside.sort);
    },
    aside: {
        sort: ul => ul.append(...ul.Q('bey-x')
            .sort((b, c) => (b.classList.contains('used') - c.classList.contains('used')) || (b.order - c.order))
            .map(b => b.parentElement)
        )
    },
    events () {
        document.addEventListener('pointerdown', () => App.interacted = true, {once: true});
        Q('aside').addEventListener('pointerdown', () => Q('aside').classList.remove('first'), {once: true});
        onhashchange = App.switch;

        new Dragging(Q('#deck'), {
            drop: {
                targets: 'main bey-x',
                when: ev => ev.target.classList.contains('selected')
            },
            lift: {
                drop: drop => drop.to.swap()
            }
        });
        new Dragging(Q('#tier'), {
            holdToRedispatch: pressed => pressed.select(),
            drop: {
                targets: ['#tier bey-x', '#tier section', '#tier'],
                when: ev => ev.target.classList.contains('selected')
            },
            lift: {
                drop: [
                    drop => drop.to.swap(), 
                    drop => drop.to.transfer(), 
                    (_, dragged) => {
                        let [c, p] = dragged.abbr[0];
                        dragged.remove();
                        let recovered = Q(`aside bey-x[${c}='${p}']`);
                        recovered.used = false;
                        App.aside.sort(recovered.closest('ul'));
                    },
                ]
            }
        });
        new Dragging(Q('aside'), {
            holdToRedispatch: pressed => pressed.select(),
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
                    let [dx, dy] = [drag.moveX - drag.pressX, drag.moveY - drag.pressY], aside = Q('aside');
                    let slided = parseInt(getComputedStyle(aside).getPropertyValue('--slided') || 0);
                    if (!drag.triggered && Math.abs(dy) > 50 && Math.atan(Math.abs(dy)/Math.abs(dx)) > Math.PI/3  
                        && (slided === 0 && dy < 0 || slided === 1 || slided === 2 && dy > 0)) {
                        drag.triggered = true; 
                        slided -= Math.sign(dy);
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
                drop: [
                    (drop, dragged, targeted) => {
                        drop.to.return();
                        targeted.setAttribute(...dragged.abbr[0]);
                    },
                    (drop, dragged) => {
                        drop.to.clone();
                        dragged.used = true;
                    },
                    () => setTimeout(() => Q('.customizing')?.classList.remove('customizing'), 500)
                ]
            }
        });
        
    },
});