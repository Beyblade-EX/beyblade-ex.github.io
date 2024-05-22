class Bey extends HTMLElement {
    constructor(bey, options) {
        super();
        this.attachShadow({mode: 'open'}).append(E('style', Bey.style), 
            E('ol', {classList: 'rank'}, Bey.eachPart('li')),
            E('span', {classList: 'spin'}),
            E('ol', {classList: 'part'}, Bey.eachPart('li')),
            E('h4', Bey.eachPart('span'))
        );
        bey && typeof bey == 'object' ?
            Object.entries(bey).forEach(([...p]) => this.setAttribute(...p)) :
            bey?.split(' ').forEach((p, i) => this.setAttribute(Bey.observedAttributes[i], p));
        options?.collapse && this.setAttribute('collapse', true);
    }
    static eachPart = el => Bey.observedAttributes.map(c => E(el, {classList: c}))
    get abbr() {
        return Bey.observedAttributes.map(c => [c, this.getAttribute(c)]).filter(([c, p]) => p);
    }
    get stringify() {
        return Bey.observedAttributes.map(c => this.getAttribute(c) || '?').join(' ');
    }
    get name() {
        let spaces = [' ', ' '];
        return this.shadowRoot.Q('h4 span').map((span, i) => (span.title || '?') + (spaces[i] || '')).join('');
    }
    Q = el => this.shadowRoot.Q(el)

    static observedAttributes = ['blade', 'ratchet', 'bit']
    attributeChangedCallback(attr, _, after) {
        attr == 'blade' && (this.blade = after);
        let index = Bey.observedAttributes.indexOf(attr);
        this.Q('.part').children[index].style.backgroundImage = `url(/img/${attr}/${after}.png)`;
        (this.change[attr] ?? (abbr => this.Q(`h4 .${attr}`).title = abbr))(after);
        this.dock?.tagName == 'MAIN' && Bey.main.validate(this.deck);
    }
    change = {
        blade: () => this.blade && (this.classList = Parts.blade[this.blade].attr.join(' ')) && this.lang(Q('#lang').value),
    }
    lang(lang) {
        this.Q('h4').classList = lang;
        let i = ['hk', 'tw'].indexOf(lang);
        if (i == -1) return this.Q('h4 .blade').title = Parts.blade[this.blade].names[lang];
        let name = Parts.blade[this.blade].names.chi.split(' ');
        this.Q('h4 .blade').title = (name[i] ?? name[0]).replace('/', '');
    }
    static lang = (lang) => Q('bey-x[blade]', bey => bey.lang(lang))
    
    connectedCallback() {
        this.dock = this.closest('main,aside');
        this.onclick = this.select;
        this.dock.tagName == 'ASIDE' && !this.shadowRoot.Q('h4 [title]:not([title=""])') && this.parentElement.remove();
        this.dock.tagName == 'MAIN' &&
            (this.deck = [...new Set([...this.neighbor('previous'), this, ...this.neighbor('next')])]) &&
            setTimeout(() => Bey.main.validate(this.deck));
    }
    select() {
        if (!this.classList.contains('selected'))
            this.dock.Q('.selected')?.classList.remove('selected');
        this.classList.toggle('selected');
    }
    neighbor(direction) {
        let el = this, ar = [];
        while (el && el.tagName == 'BEY-X') {
            ar.push(el);
            el = el[`${direction}ElementSibling`];
        }
        return ar;
    }
    containsPointer = (dragX, dragY) => (({x, y, width, height}) => 
        dragX > x && dragY > y && dragX < x+width && dragY < y+height
    )(this.getBoundingClientRect())
    
    static main = {
        validate(deck) {
            let parts = deck.flatMap(b => b.abbr);
            let unique = [...new Set(parts.map(pairs => pairs.join('#')))];
            let duplicated = unique.map(p => p.split('#')).filter(([c, p]) => parts.filter(([d, q]) => c === d && p === q).length > 1);
            deck.forEach(bey => bey.validate(duplicated));
        }
    }
    validate(duplicated) {
        this.shadowRoot.querySelectorAll('.duplicated').forEach(span => span.classList.remove('duplicated'));
        duplicated?.forEach(([c, p]) => this.getAttribute(c) === p && this.Q(`span.${c}`).classList.add('duplicated'));
    }
    static style = `
    :host {
        display:inline-grid; grid-template:1.5em min(calc((100vw - 2rem)/3),8em) 1.5em / min(calc((100vw - 2rem)/3),8em);
        border-radius:.5em;
        background:rgba(255,255,255,.3);
        outline:.2em solid transparent;
    }
    :host(.selected) {
        outline-color:var(--theme) !important;
    }
    :host(.targeted) {
        outline-color:var(--theme-alt) !important;
    }
    * {
        user-select:none;
    }
    ol {
        list-style:none; padding:0; margin:0;
        height:100%; /*safari*/
    }
    .rank {
        text-align:left;
        grid-area:1/1/2/2; align-self:end;
        visibility:hidden;
    }
    :host(:not([blade])) .rank,
    :host(:not([ratchet]):not([bit])) .rank li:nth-child(n+2) {
        visibility:hidden;
    }
    .rank li {
        display:inline-block; height:1.2em;
        margin-right:.2em;
        background:var(--on); color:black;
        padding:0 .1em;
        line-height:1.4;
    }
    .rank li::before,h4 [title]::before {
        content:attr(title);
    }
    .rank li:first-child {
        margin-left:.3rem;
    }
    .spin {
        grid-area:1/1/2/2; justify-self:end;
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
        text-align:center;
        white-space:nowrap;
    }
    .duplicated {
        color:red;
    }
    :host([class]:not([class='']):not([collapse])) h4 span:not([title])::before {content:'?';}
    h4 span:nth-child(1):has(+span[title])::after {content:' '}
    h4 span:nth-child(2):has(+span[title])::after {content:' '}
    :host([collapse]) {
        grid-template-rows:0 min(calc((100vw - 2rem)/3),8em) 0;
        outline:.1em solid; outline-offset:-.1em;
    }
    :host([collapse]) :is(.rank,.spin) {
        align-self:start;
    }
    :host([collapse]) h4 {
        align-self:end;
        color:white;
        mix-blend-mode:exclusion;
    }
    :host([collapse]) {font-size:1em;}
    :host([collapse]) h4.eng {font-size:.9em;}
    :host([collapse]) h4.jap {font-size:.7em; margin-bottom:.2em;}

    :host(:not([collapse])) h4 {font-size:.7em;}
    :host(:not([collapse])) h4.eng {font-size:.65em;}
    :host(:not([collapse])) h4.jap {font-size:.55em;}
    :host(:not([collapse])) h4.jap span:first-child {letter-spacing:-.05em;}
    `
}
customElements.define('bey-x', Bey);
