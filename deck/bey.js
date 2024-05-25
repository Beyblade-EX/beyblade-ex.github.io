class Bey extends HTMLElement {
    constructor(bey, options) {
        super();
        this.attachShadow({mode: 'open'}).append(
            E('style', Bey.style), 
            E('i'),
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
    static eachPart = el => Bey.observedAttributes.map(c => E(el, {classList: c}))
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
        let spaces = [' ', ' '];
        return this.shadowRoot.Q('h4 span').map((span, i) => (span.title || '?') + (spaces[i] || '')).join('');
    }
    sQ = el => this.shadowRoot.Q(el)

    static observedAttributes = ['blade', 'ratchet', 'bit']
    attributeChangedCallback(attr, _, after) {
        this[attr] = after;
        this.sQ(`.part .${attr}`).style.backgroundImage = `url(/img/${attr}/${after}.png)`;
        this.change[attr] ? this.change[attr]() : this.sQ(`h4 .${attr}`).title = after;
        this.change.class(attr);
        this.dock?.tagName == 'MAIN' && this.main();
    }
    change = {
        blade: () => this.blade && this.lang(Q('#lang').value),
        class: async (attr) => {
            if (attr == 'blade') {
                let spin = this.spin || this[attr] && (this.refer.from.aside(attr)?.spin || (await this.refer.from.DB(attr)).attr?.[1]) || '';
                this.setAttribute('spin', spin || '');
            } 
            if (!this.hasAttribute('expand') && attr == 'blade' || attr == 'bit') {
                let type = this.type || this[attr] && (this.refer.from.aside(attr)?.type || (await this.refer.from.DB(attr)).attr?.[0]) || '';
                this.setAttribute('type', type || '');
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
        if (i == -1) return this.sQ('h4 .blade').title = (await DB.get('blade', this.blade)).names[lang];
        let name = (await DB.get('blade', this.blade)).names.chi.split(' ');
        this.sQ('h4 .blade').title = (name[i] ?? name[0]).replace('/', '');
    }
    static lang = (lang) => Q('bey-x[blade]', bey => bey.lang(lang)) ?? App.save()
    
    connectedCallback() {
        this.dock = this.closest('main,aside');
        this.dock.tagName == 'MAIN' && this.main(true);
    }
    disconnectedCallback() {
        this.dock.tagName == 'MAIN' && !this.parentElement && this.main();
    }
    select() {
        if (this.classList.contains('used')) return;
        if (!this.classList.contains('selected'))
            this.dock.Q('.selected')?.classList.remove('selected');
        this.classList.toggle('selected');
        navigator.vibrate?.(200);
    }

    main(redeck) {
        this.dock.id == 'deck' && redeck && (this.deck = this.parentElement.Q('bey-x'));
        setTimeout(() => {
            this.dock.id == 'deck' && Bey.main.validate(this.deck); 
            App.save(location.hash);
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

    set used(used) {
        this.classList[used ? 'add' : 'remove']('used');
        used && this.closest('ul').append(this.parentElement);
    }
    static style = `
    :host {
        display:inline-grid; grid-template:0 min(calc((100vw - 2rem)/3),8em) 0 / min(calc((100vw - 2rem)/3),8em);
        border-radius:.5em;
        outline:.1em solid; outline-offset:-.1em;
    }
    :host([expand]) {
        grid-template-rows:1.5em min(calc((100vw - 2rem)/3),8em) 1.5em;
        outline:.2em solid transparent;
    }
    :host([expand]) {
        background:rgba(255,255,255,.3);
    }
    :host(.used) {
        opacity:.3;
    }
    :host(.selected) {
        outline-color:var(--theme) !important;
        z-index:2;
    }
    :host(.targeted) {
        outline-color:var(--theme-alt) !important;
    }
    * {
        user-select:none; -webkit-user-select:none;
    }
    ol {
        list-style:none; padding:0; margin:0;
        height:100%; /*safari*/
    }

    h4 [title]::after {
        content:attr(title);
    }
    i {
        grid-area:1/1/2/2; justify-self:end; align-self:start;
        font-style:normal;
        display:flex; justify-content:space-between; width:100%;
        padding:.3em; box-sizing:border-box;
    }
    :host([expand]) i {
        justify-content:end; gap:.2em;
    }
    i::before {
        content:'';
        height:1.5em; width:1.5em; display:inline-block;
        background:url() no-repeat center / contain;
    }
    i::after {
        content:'';
        font-size:1.2em; line-height:1.4;
    }
    :host([type=att]) i::before {background-image:url(/img/type-att.png);}
    :host([type=bal]) i::before {background-image:url(/img/type-bal.png);}
    :host([type=def]) i::before {background-image:url(/img/type-def.png);}
    :host([type=sta]) i::before {background-image:url(/img/type-sta.png);}
    :host([spin=right]) i::after {content:'\ue01e';}
    :host([spin=left]) i::after {content:'\ue01d';}
    :host([spin=dual]) i::after {content:'\ue01d \ue01e';}
    .part {
        overflow:hidden;
    }
    .part li {
        width:90%; height:90%; margin:5%;
        background:url() no-repeat center center / contain;
    }
    .part li:not([style]) {
        display:none;
    }
    h4 {
        margin:0;
        text-align:center; font-weight:normal; /*safari*/
        white-space:nowrap;
        align-self:end;
        color:white; mix-blend-mode:exclusion;
    }
    :host([expand]) h4 {
        align-self:initial;
        mix-blend-mode:initial;
    }
    .duplicated {
        color:red;
    }
    :host([expand]) h4:has(span[title]) span:not([title])::after {content:'?';}
    :host([expand]) h4 span:nth-child(2)::before {content:' ';}
    :host([expand]) h4 span:nth-child(3)::before {content:' ';}

    :host h4 {font-size:1em;}
    :host h4.eng {font-size:.9em;}
    :host h4.jap {font-size:.7em; margin-bottom:.2em;}

    :host([expand]) h4 {font-size:.7em;}
    :host([expand]) h4.eng {font-size:.65em;}
    :host([expand]) h4.jap {font-size:.55em;}
    :host([expand]) h4.jap span:first-child {letter-spacing:-.05em;}
    `
}
customElements.define('bey-x', Bey);
