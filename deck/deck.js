const Aside = {
    
}
const App = () => {
    let create = (where, title) => {
        let deck = Q(`${where} template`).content.cloneNode(true);
        deck.Q('h2').title = title;
        Q(where).append(deck);
    }
    [1,2,3,4,5].forEach(t => create('#deck', t));
    [1,2,3,4,5].forEach(t => create('#tier', t));
};
Object.assign(App, {
    load () {
        DB.get('user', 'pref').then(re => re && (Q('#lang').value = re.lang));
        return Promise.all([
            DB.get('user', '#deck').then(re =>
                re?.forEach((deck, i) => Q(`#deck article:nth-of-type(${i+1}) bey-x`, (bey, j) => bey.init(deck[j])))
            ),
            DB.get('user', '#tier').then(re => Object.entries(re ?? {}).forEach(([tier, beys]) =>
                Q(`h2[title='${tier}']+div span`).before(...beys.map(([c, p]) => [new Bey({[c]: p}, {collapse: true}), ' ']).flat())
            ))
        ]);
    },
    fetch () {
        let groups = ['round', 'flat', 'sharp', 'multi'];
        let sorter = {
            blade: (p, q) => Sorter.sort.weight(p, q),
            ratchet: (p, q) => parseInt(p.abbr.split('-')[1]) - parseInt(q.abbr.split('-')[1]),
            bit: (p, q) => groups.indexOf(p.group ?? Parts.bit[p.abbr.at(-1)].group) - groups.indexOf(q.group ?? Parts.bit[q.abbr.at(-1)].group)
        };
        return Parts.getMeta().then(() => Promise.all(['blade', 'ratchet', 'bit'].map(c => DB.get.parts(c)
            .then(parts => c == 'bit' ? Promise.all(parts.map(p => new Part(p).revise())) : parts)
            .then(parts => 
                Q(`aside .${c}`).append(...parts
                    .filter(p => c != 'blade' || c == 'blade' && p.names.chi)
                    .sort(sorter[c]).map((p, i) => E('li', [new Bey({[c]: p.abbr}, {attr: p.attr, order: i, collapse: true})]) 
                ))
        ))));
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
        Q('main', main => main.hidden = true);
        Q(location.hash ||= '#deck').hidden = false;
        Q('nav a:nth-of-type(2)').href = location.hash == '#deck' ? '#tier' : '#deck';
        Q('.deck', el => el.hidden = location.hash != '#deck');
        if (location.hash == '#deck') {
            [Q('bey-x.used')].flat().forEach(bey => bey && (bey.used = false));
            Q('ul', ul => ul.append(...ul.Q('bey-x').sort((b, c) => b.order - c.order).map(bey => bey.parentElement)));
        } else {
            [Q('#tier bey-x')].flat().forEach(({abbr}) => Q(`aside bey-x[${abbr[0][0]}='${abbr[0][1]}']`).used = true);
        }
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
                drop: (_, dragged, targeted) => targeted ? Swapping.swap(dragged, targeted) : (dragged.style.transform = null)
            }
        });
        new Dragging(Q('#tier'), {
            holdToRedispatch: pressed => pressed.select(),
            drop: {
                targets: ['#tier bey-x', '#tier h2+div', '#tier'],
                when: ev => ev.target.classList.contains('selected')
            },
            lift: {
                drop (_, dragged, targeted) {
                    if (targeted?.tagName == 'BEY-X') 
                        return Swapping.swap(dragged, targeted);
                    if (targeted?.tagName == 'DIV')
                        targeted?.append(dragged);
                    else if (targeted?.tagName == 'MAIN') {
                        let [c, p] = dragged.abbr[0];
                        dragged.remove();
                        let recovered = Q(`aside bey-x[${c}='${p}']`);
                        recovered.used = false;
                        recovered.closest('ul').append(...recovered.closest('ul').Q('bey-x')
                            .sort((b, c) => (b.classList.contains('used') - c.classList.contains('used')) || (b.order - c.order))
                            .map(bey => bey.parentElement)
                        );
                    }
                    dragged.style.transform = null;
                }
            }
        });
        new Dragging(Q('aside'), {
            holdToRedispatch: pressed => pressed.select(),
            scroll: {
                what: 'ul',
                when: ev => !ev.target.matches('.selected'),
            },
            drop: {
                targets: '#deck bey-x,#tier div',
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
                scroll (self) {
                    let [dx, dy] = [self.moveX - self.pressX, self.moveY - self.pressY], aside = Q('aside');
                    let slided = parseInt(getComputedStyle(aside).getPropertyValue('--slided') || 0);
                    if (!self.triggered && Math.abs(dy) > 50 && Math.atan(Math.abs(dy)/Math.abs(dx)) > Math.PI/3  
                        && (slided === 0 && dy < 0 || slided === 1 || slided === 2 && dy > 0)) {
                        self.triggered = true; 
                        slided -= Math.sign(dy);
                        aside.style.setProperty('--slided', slided);
                        Dragging.class.temp(aside, 'sliding');
                        Dragging.class.switch(`aside ul:nth-child(${slided+1})`, 'selecting');
                    }
                },
            },
            lift: {
                scroll (self) {
                    clearTimeout(self.timer);
                    self.triggered = false;
                },
                drop (_, dragged, targeted) {
                    dragged.style.transform = null;
                    setTimeout(() => Q('.customizing')?.classList.remove('customizing'), 500);
                    if (!targeted) return;
                    if (targeted.tagName == 'BEY-X')
                        return targeted?.setAttribute(...dragged.abbr[0]);
                    dragged.classList.remove('selected');
                    targeted.Q('span').before(dragged.cloneNode(true), ' ');
                    dragged.used = true;
                }
            }
        });
        
    },
});
const Swapping = {
    swap (dragged, targeted) {
        let {x, y} = Dragging.getBoundingPageRect(targeted);
        dragged.style.transform = `translate(${x - dragged.origin.x}px,${y - dragged.origin.y}px)`;
        targeted.style.transform = `translate(${dragged.origin.x - x}px,${dragged.origin.y - y}px)`;
        setTimeout(() => Swapping.commit(dragged, targeted), 500);
    },
    commit (dragged, targeted) {
        let place = targeted.nextSibling;!place &&console.log(dragged)
        dragged.before(targeted);
        place.before(dragged);
        dragged.style.transform = targeted.style.transform = null;
    }
};