const Swapping = {
    swap (dragged, targeted) {
        let {x, y} = Dragging.getBoundingPageRect(targeted);
        dragged.style.transform = `translate(${x - dragged.origin.x}px,${y - dragged.origin.y}px)`;
        targeted.style.transform = `translate(${dragged.origin.x - x}px,${dragged.origin.y - y}px)`;
        setTimeout(() => Swapping.commit(dragged, targeted), 500);
    },
    commit (dragged, targeted) {
        let place = targeted.nextSibling;
        dragged.before(targeted);
        place.before(dragged);
        dragged.style.transform = targeted.style.transform = null;
    }
};
const Aside = {
    
}
const App = () => {
    let create = (where, title) => {
        let deck = Q(`${where} template`).content.cloneNode(true);
        deck.Q('h2').title = title;
        Q(where).append(deck);
    }
    [1,2,3,4,5].forEach(t => create('#deck', t));
    ['S','A','B','C','D'].forEach(t => create('#tier', t));
    Object.assign(indexedDB.open('user', 1), {
        onsuccess: ev => App.DB = ev.target.result,
        onerror: console.error,
        onupgradeneeded: ev => (App.familiar = false) && ev.target.result.createObjectStore('user')
    });
};
Object.assign(App, {
    load () {
        let store = App.DB.transaction('user').objectStore('user');
        store.get('pref').onsuccess = ev => (({lang}) => Q('#lang').value = lang)(ev.target.result);
        App.familiar !== false && Q('aside.first').classList.remove('first');
        return Promise.all([
        new Promise(res => store.get('#deck').onsuccess = ev => res(
            ev.target.result?.forEach((deck, i) => Q(`#deck article:nth-of-type(${i+1}) bey-x`, (bey, j) => bey.init(deck[j])))
        )),
        new Promise(res => store.get('#tier').onsuccess = ev => res(
            Object.entries(ev.target.result ?? {}).forEach(([tier, beys]) => {
                Q(`h2[title=${tier}]+div span`).before(...beys.map(([c, p]) => [new Bey({[c]: p}, {collapse: true}), ' ']).flat());
            })
        ))]);
    },
    fetch () {
        let groups = ['round', 'flat', 'sharp', 'multi'];
        let sorter = {
            blade: ([_1, p], [_2, q]) => Sorter.sort.weight(p, q),
            ratchet: ([p], [q]) => parseInt(p.split('-')[1]) - parseInt(q.split('-')[1]),
            bit: ([a, p], [b, q]) => groups.indexOf(p.group ?? Parts.bit[a.at(-1)].group) - groups.indexOf(q.group ?? Parts.bit[b.at(-1)].group)
        };
        return Promise.all(['blade', 'ratchet', 'bit'].map(c => Fetch(`/db/part-${c}.json`).then(resp => resp.json()).then(p => {
            Parts[c] = p;
            Q(`aside .${c}`).append(...Object.entries(p)
                .filter(([_, p]) => c!= 'blade' || c == 'blade' && p.names.chi)
                .sort(sorter[c]).map(([abbr], i) => E('li', [new Bey({[c]: abbr}, {order: i, collapse: true})]) 
            ));
        })));
    },
    save (hash) {
        let store = App.DB.transaction('user', 'readwrite').objectStore('user');
        hash == '#deck' && store.put(Q('#deck article').map(article => article.Q('bey-x').map(bey => bey.string)), '#deck');
        hash == '#tier' && store.put(Q('#tier article').reduce((obj, article) => 
            ({...obj, [article.Q('h2').title]: [...article.querySelectorAll('bey-x')].map(bey => bey.abbr[0])}),{}), '#tier');
        hash || store.put({lang: Q('#lang').value}, 'pref');
    },
    switch () {
        Q('main', main => main.hidden = true);
        Q(location.hash ||= '#deck').hidden = false;
        Q('nav a:nth-of-type(2)').href = location.hash == '#deck' ? '#tier' : '#deck';
        if (location.hash == '#deck') {
            [Q('bey-x.used')].flat().forEach(bey => bey && (bey.used = false));
            Q('ul', ul => ul.append(...ul.Q('bey-x').sort((b, c) => b.order - c.order).map(bey => bey.parentElement)));
        } else {
            [Q('#tier bey-x')].flat().forEach(({abbr}) => Q(`aside bey-x[${abbr[0][0]}='${abbr[0][1]}']`).used = true);
        }
    },
    events () {
        Q('aside').addEventListener('pointerdown', ev => ev.target.classList.remove('first'), {once: true});
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
            drop: {
                targets: ['#tier bey-x', '#tier h2+div', '#tier'],
                when: ev => ev.target.classList.contains('selected')
            },
            lift: {
                drop (_, dragged, targeted) {
                    if (targeted?.tagName == 'BEY-X') 
                        return Swapping.swap(dragged, targeted);
                    if (targeted?.tagName == 'DIV') {
                        targeted?.append(dragged);
                        dragged.style.transform = null;
                    }
                    if (targeted?.tagName == 'MAIN') {
                        let [c, p] = dragged.abbr[0];
                        let recovered = Q(`aside bey-x[${c}='${p}']`);
                        dragged.remove();
                        recovered.used = false;
                        recovered.closest('ul').append(...recovered.closest('ul').Q('bey-x')
                            .sort((b, c) => (b.classList.contains('used') - c.classList.contains('used')) || (b.order - c.order))
                            .map(bey => bey.parentElement)
                        );
                    }
                }
            }
        });
        new Dragging(Q('aside'), {
            scroll: {
                what: 'ul',
                when: ev => !ev.target.matches('.selected'),
            },
            drop: {
                targets: '#deck bey-x,#tier div',
                when: ev => ev.target.matches('.selected')
            },
            press: {
                scroll (self) {
                    self.timer = setTimeout(() => {
                        self.ev.target.select();
                        onpointermove = onpointerup = onpointercancel = onscroll = null;
                        self.ev.target.dispatchEvent(new MouseEvent('pointerdown', self.ev));
                    }, 500);
                },
                drop () {
                    let list = Q('aside .selecting');
                    list.style.setProperty('--scrolled', list.scrollLeft);
                    Q('aside').classList.add('customizing');
                }
            },
            move: {
                scroll (self) {
                    clearTimeout(self.timer);
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
                    targeted.Q('span').before(dragged.cloneNode(true), ' ');
                    dragged.used = true;
                }
            }
        });
        
    },
});