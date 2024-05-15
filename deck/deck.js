class Bey extends HTMLElement {
    constructor(bey) {
        super();
        this.attachShadow({mode: 'open'}).append(E('style', Bey.style), 
            E('ol', {classList: 'rank'}, [E('li'), E('li'), E('li')]),
            E('span', {classList: 'spin'}),
            E('ol', {classList: 'part'}, [E('li'), E('li'), E('li')]),
            E('h4', [E('span'), E('span'), E('span')])
        );
        bey?.split(' ').forEach((p, i) => this.setAttribute(Bey.observedAttributes[i], p));
    }
    Q = el => this.shadowRoot.Q(el)
    attributeChangedCallback(attr, _, after) {
        let index = Bey.observedAttributes.indexOf(attr);
        this.Q('.part').children[index].style.backgroundImage = `url(/img/${attr}/${after}.png)`;
        this.Q('.rank').children[index].title = 'S';
        this.change[attr]?.(after);
    }
    change = {
        blade: (abbr) => (this.Q('.spin').textContent = '\ue01d') && (this.Q('h4 span:nth-child(1)').title = '核輪固鎖輪盤'),
        ratchet: (abbr) => this.Q('h4 span:nth-child(2)').title = abbr,
        bit: (abbr) => this.Q('h4 span:nth-child(3)').title = abbr
    }
    static observedAttributes = ['blade', 'ratchet', 'bit']
    connectedCallback() {
        this.onclick = () => Q('.editing')?.classList.remove('editing') ?? this.classList.toggle('editing');
        this.deck = new Set([...this.neighbor('previous'), this, ...this.neighbor('next')]);
        Bey.validate(this.deck);
    }
    neighbor(direction) {
        let el = this, ar = [];
        while (el && el.tagName == 'BEY-X') {
            ar.push(el);
            el = el[`${direction}ElementSibling`];
        }
        return ar;
    }
    getBoundingPageRect = () => (({x, y, width, height}) => ({
        x: x + scrollX,
        y: y + scrollY,
        width, height
    }))(this.getBoundingClientRect())
    containsPointer = (dragX, dragY) => (({x, y, width, height}) => 
        dragX > x && dragY > y && dragX < x+width && dragY < y+height
    )(this.getBoundingPageRect())
    
    static validate(deck) {

    }
    static style = `
    :host {
        display:inline-grid; grid-template:1.5em min(calc((100vw - 2rem)/3),8em) 1.5em / min(calc((100vw - 2rem)/3),8em);
        border-radius:.5em;
        background:rgba(255,255,255,.3);
    }
    :host(.editing) {
        outline:.2em solid var(--theme);
    }
    :host(.target) {
        outline:.2em solid var(--theme-alt);
    }
    * {
        user-select:none;
    }
    ol {
        list-style:none; padding:0; margin:0;
    }
    .rank {
        text-align:left;
        grid-area:1/1/2/2; align-self:end;
    }
    :host(:not([blade])) .rank,
    :host(:not([ratchet]):not([bit])) .rank li:nth-child(n+2) {
        visibility:hidden;
    }
    .rank li {
        display:inline-block; height:1.2em;
        margin-right:.2em;
        background:white; color:black;
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
        grid-area:1/1/2/2; justify-self:end; align-self:end;
        line-height:1;
        margin-right:.3rem;
    }
    .part {
        overflow:hidden;
    }
    .part li {
        width:90%; height:90%; margin:5%;
        background:url() no-repeat center center / contain;
    }
    h4 {
        margin:0;
        font-size:.7em;
        white-space:nowrap;
    }
    h4 span:nth-child(1):has(+span[title])::after {
        content:' '
    }
    h4 span:nth-child(2):has(+span[title])::after {
        content:' '
    }
    :host-context(body[style]) :is(span,li)[title]::before,.spin {
        display:inline-block;
        transform:translateY(var(--canvas));
    }
    :host-context(body[style]) [title]::before {
        padding-right:.2rem;
    }
    `
}