class Bey extends HTMLElement {
    constructor(bey, options) {
        super();
        this.attachShadow({mode: 'open'}).append(
            E('style', Bey.style), 
            E('i', [E('img')]),
            E('ol', {classList: 'part'}, Bey.eachPart('li')),
            E('h4', Bey.eachPart('span'))
        );
        if (options?.attr) {
            bey.blade && (this.spin = options.attr[1]);
            (bey.blade || bey.bit) && (this.type = options.attr[0]);
        }
        options?.collapse && this.setAttribute('collapse', true);
        this.order = options?.order;
        this.init(bey);
        this.onclick = this.select;
    }
    static eachPart = el => Bey.observedAttributes.map(c => E(el, {classList: c}, el == 'li' ? [E('img')] : null))
    init(bey) {
        bey && typeof bey == 'object' ?
            Object.entries(bey).forEach(([...p]) => this.setAttribute(...p)) :
            bey?.split(' ').forEach((p, i) => p != '?' && this.setAttribute(Bey.observedAttributes[i], p));
    }
    get abbr() {
        return Bey.observedAttributes.map(c => [c, this.getAttribute(c)]).filter(([c, p]) => p);
    }
    get string() {
        return Bey.observedAttributes.map(c => this.getAttribute(c) || '?').join(' ');
    }
    get name() {
        return this.shadowRoot.Q('h4 span').filter(span => span.title).map(span => span.title).join(' ').trim();
    }

    static observedAttributes = ['blade', 'ratchet', 'bit']
    attributeChangedCallback(attr, _, after) {
        this[attr] = after;
        after ? this.sQ(`.part .${attr} img`).src = `/img/${attr}/${after}.png` : this.sQ(`.part .${attr} img`).removeAttribute('src');
        after && this.change[attr] ? this.change[attr]() : (this.sQ(`h4 .${attr}`).title = after) || this.sQ(`h4 .${attr}`).removeAttribute('title');
        this.change.class(attr);
        this.dock?.tagName == 'MAIN' && this.main();
    }
    delete = () => Bey.observedAttributes.forEach(c => this.removeAttribute(c))
    change = {
        blade: () => this.lang(Q('#lang').value),
        class: async (attr) => {
            if (attr == 'blade') {
                let spin = this.spin || this[attr] && (this.refer.from.aside(attr)?.spin || (await this.refer.from.DB(attr)).attr?.[1]) || '';
                this.setAttribute('spin', spin || '');
            } 
            if (this.hasAttribute('collapse') && attr == 'blade' || attr == 'bit') {
                let type = this.type || this[attr] && (this.refer.from.aside(attr)?.type || (await this.refer.from.DB(attr)).attr?.[0]) || '';
                this.sQ('i img').src = `/img/types.svg?${type}#${type}`;
            }
        }
    }
    refer = {
        from: {
            aside: (c) => Q(`aside [${c}='${this[c]}']`),
            DB: (c) => DB.get(c, this[c]).then(p => c == 'bit' ? new Part(p).revise() : p),
        }
    }
    async lang(lang) {
        this.sQ('h4').classList = lang;
        let i = ['hk', 'tw'].indexOf(lang);
        if (i == -1) return this.sQ('h4 .blade').title = NAMES.blade[this.blade][lang];
        let name = NAMES.blade[this.blade].chi.split(' ');
        this.sQ('h4 .blade').title = (name[i] ?? name[0]).replace('/', '');
    }
    static lang = (lang) => Q('bey-x[blade]', bey => bey.lang(lang))
    
    connectedCallback() {
        this.dock = this.closest('main,aside');
        this.dock.tagName == 'MAIN' && this.main(true);
    }
    disconnectedCallback() {
        this.dock.tagName == 'MAIN' && !this.parentElement && this.main();
    }
    select() {
        if (!this.classList.contains('selected'))
            this.dock.Q('.selected')?.classList.remove('selected');
        this.classList.toggle('selected');
        navigator.vibrate?.(100);
    }

    main(redeck) {
        this.dock.id == 'deck' && setTimeout(() => {
            redeck && (this.deck = this.parentElement.Q('bey-x'));
            Bey.main.validate(this.deck); 
        });
    }
    static main = {
        validate(deck) {
            let parts = deck.flatMap(b => b.abbr);
            let unique = [...new Set(parts.map(pairs => pairs.join('#')))];
            let duplicated = unique.map(p => p.split('#')).filter(([c, p]) => parts.filter(([d, q]) => c === d && p === q).length > 1);
            deck.forEach(bey => bey.violate(duplicated));
        }
    }
    violate(duplicated) {
        this.shadowRoot.querySelectorAll('.duplicated').forEach(span => span.classList.remove('duplicated'));
        duplicated?.forEach(([c, p]) => this.getAttribute(c) === p && this.sQ(`span.${c}`).classList.add('duplicated'));
    }
    set used(used) {used > 0 ? this.setAttribute('used', used) : this.removeAttribute('used');}

    static style = `
    :host {
        display:grid; grid-template:var(--headfoot) auto var(--headfoot) / min(calc((100vw - 2rem)/3),8em);
        --headfoot:1.5em;
        border-radius:.5em;
        outline-offset:-.1em; outline:.2em solid transparent;
        background:var(--overlay2);
        position:relative;
    }
    :host(.selected),:host(.deletable) {
        outline-color:var(--theme) !important;
        z-index:2;
    }
    :host(.targeted) {
        outline-color:var(--theme-alt) !important;
    }
    :host::after {
        position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
        z-index:1;
        background:#00000099;
        font-size:2em;
        padding:0 .2em; display:inline-block;
    }

    i {
        grid-area:1/1/2/2;
        font-style:normal;
        display:flex; justify-content:end; gap:.2em;
        width:100%;
        padding:.3em; box-sizing:border-box;

        img {
            height:1.5em; width:1.5em;
        }
        &:empty,img:not([src]) {display:none;}
        &::after {
            font-size:1.2em; line-height:1.4;
        }
    }
    :host([spin=right]) i::after {content:'\ue01e';}
    :host([spin=left]) i::after {content:'\ue01d';}
    :host([spin=dual]) i::after {content:'\ue01d \ue01e';}
    .part {
        list-style:none; padding:0; margin:5%;
        overflow:hidden;
        aspect-ratio:1/1; transition:aspect-ratio .5s;

        li {
            display:flex; place-content:center; place-items:center;
            aspect-ratio:1/1;

            img {
                max-width:100%; max-height:100%;
                pointer-events:none;
            }
            &.bit img {height:100%; /*safari*/}
        }
        li:not(:has(img[src])) {display:none;}
    }
    :host([expand]) ol {aspect-ratio:1/3;}
    :host([expand]) li:not(:has(img[src])) {display:block;}

    h4 {
        margin:0;
        text-align:center; font-weight:normal; /*safari*/
        white-space:nowrap;
        color:white;
    }
    .duplicated {
        color:red;
    }
    h4 [title]::after {content:attr(title);}
    h4:has(span[title]) span:not([title])::after {content:'?';}
    h4 span:nth-child(2)::before {content:' ';}
    h4 span:nth-child(3)::before {content:' ';}

    :host([collapse]) {
        --headfoot:0;
        outline:.1em solid;
    }
    :host([collapse]) i {justify-content:space-between;}
    :host([collapse]) h4 {align-self:end;}
    :host([collapse]) span::before,:host([collapse]) span:not([title])::after {content:'' !important;}

    :host h4 {
        font-size:.7em;
        &.eng {font-size:.65em;}
        &.jap {font-size:.55em;}
        &.jap span:first-child {letter-spacing:-.05em;}
    }
    :host([collapse]) h4 {
        font-size:1em;
        &.eng {font-size:.9em;}
        &.jap {font-size:.7em; margin-bottom:.2em;}
    }
    `
}
customElements.define('bey-x', Bey);
