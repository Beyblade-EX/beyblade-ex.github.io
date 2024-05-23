class Bey extends HTMLElement {
    constructor(bey, options) {
        super();
        this.attachShadow({mode: 'open'}).append(
            E('style', Bey.style), 
            E('span', {classList: 'spin'}),
            E('ol', {classList: 'part'}, Bey.eachPart('li')),
            E('h4', Bey.eachPart('span'))
        );
        this.init(bey);
        this.onclick = this.select;
        this.order = options?.order;
        options?.collapse && this.setAttribute('collapse', true);
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
        this.change.class();
        this.dock?.tagName == 'MAIN' && this.main();
    }
    change = {
        blade: () => this.blade && this.lang(Q('#lang').value),
        class: () => this.classList = `${Parts.blade?.[this.blade]?.attr[1] ?? ''} ${Parts.bit?.[this.bit]?.attr?.[0] ?? ''}`
    }
    lang(lang) {
        this.sQ('h4').classList = lang;
        let i = ['hk', 'tw'].indexOf(lang);
        if (i == -1) return this.sQ('h4 .blade').title = Parts.blade[this.blade].names[lang];
        let name = Parts.blade[this.blade].names.chi.split(' ');
        this.sQ('h4 .blade').title = (name[i] ?? name[0]).replace('/', '');
    }
    static lang = (lang) => Q('bey-x[blade]', bey => bey.lang(lang)) ?? (App.DB && App.save())
    
    connectedCallback() {
        this.dock = this.closest('main,aside');
        this.dock.tagName == 'MAIN' && this.main(true);
    }
    disconnectedCallback() {
        this.dock.tagName == 'MAIN' && this.main(true);
    }
    select() {
        if (!this.classList.contains('selected'))
            this.dock.Q('.selected')?.classList.remove('selected');
        this.classList.toggle('selected');
    }

    main(redeck) {
        this.dock.id == 'deck' && redeck && (this.deck = this.parentElement.Q('bey-x'));
        setTimeout(() => {
            this.dock.id == 'deck' && Bey.main.validate(this.deck); 
            App.DB && App.save(location.hash);
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
        pointer-events:none;
        opacity:.5;
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
    .spin {
        grid-area:1/1/2/2; justify-self:end; align-self:start;
        line-height:2;
        margin-right:.3rem;
    }
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
