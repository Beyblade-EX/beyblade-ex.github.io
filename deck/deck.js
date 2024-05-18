class Dragging {
    constructor (el, custom) {
        this.selector = el, this.custom = custom;
        Q(el, el => el.onpointerdown = ev => this.press(ev, custom));
    }
    press (ev, custom) {
        if (custom.precondition && !custom.precondition(ev)) return; 
        let dragged = ev.target.closest(this.selector);
        [this.pressX, this.pressY, this.scrollX, this.scrollY, this.scrollInitY] = [ev.x, ev.y, dragged.scrollLeft, 0, scrollY];
        dragged.origin = Dragging.getBoundingPageRect(dragged);
        this.targets = custom.drop;
        onpointermove = ev => this.move(ev, dragged, custom?.move);
        onscroll = () => this.move(null, dragged)
        onpointerup = onpointercancel = () => this.lift(null, dragged, custom?.lift);
    }
    move (ev, dragged, custom) {
        ev?.preventDefault();
        document.body.classList.add('dragging');
        ev ? 
            [this.moveX, this.moveY, this.clientX, this.clientY] = [ev.x, ev.y, ev.clientX, ev.clientY] : 
            [this.moveY, this.scrollY] = [this.moveY, dragged.hasAttribute('collapse') ? 0 : scrollY - this.scrollInitY];
        if (!this.targets) {
            dragged.scrollTo(this.scrollX - this.moveX + this.pressX, 0);
            return custom(this, dragged);
        }
        dragged.style.transform = `translate(${this.moveX - this.pressX}px,${this.moveY - this.pressY + this.scrollY}px)`;
        this.autoScroll();
        let target = this.clientY > Q('aside').offsetTop ? null : this.targets.find(bey => bey != dragged && bey.containsPointer(this.moveX, this.moveY));
        if (target?.matches('.targeted')) return;
        Q('.targeted')?.classList.remove('targeted');
        target?.classList.add('targeted');
    }
    lift (_, dragged, custom) {
        onpointermove = onpointerup = onpointercancel = onscroll = null;
        document.body.classList.remove('dragging');
        custom?.(this, dragged);
    }
    static getBoundingPageRect = el => (({x, y, width, height}) => ({
        x: x + scrollX,
        y: y + scrollY,
        width, height
    }))(el.getBoundingClientRect())
    autoScroll () {
        let [proportion, bottomed] = [this.clientY / innerHeight, scrollY >= document.body.offsetHeight - innerHeight];
        proportion < .1 ? scrollBy(0, -3) : 
        proportion > .9 && !bottomed ? scrollBy(0, 3) : null;
    }
}

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
        options?.pool && this.setAttribute('pool', true);
    }
    static eachPart = el => Bey.observedAttributes.map(c => E(el, {classList: c}))
    get abbr() {
        return Bey.observedAttributes.map(c => [c, this.getAttribute(c)]).filter(([c, p]) => p);
    }
    get stringify() {
        return Bey.observedAttributes.map(c => this.getAttribute(c) || '?').join(' ');
    }
    get parts() {
        return Bey.observedAttributes.map(c => [c, this.getAttribute(c)]).filter(([c, p]) => p);
    }
    Q = el => this.shadowRoot.Q(el)

    static observedAttributes = ['blade', 'ratchet', 'bit']
    attributeChangedCallback(attr, _, after) {
        let index = Bey.observedAttributes.indexOf(attr);
        this.Q('.part').children[index].style.backgroundImage = `url(/img/${attr}/${after}.png)`;
        this.change[attr](after);
        this.isConnected && Bey.validate(this.deck);
    }
    change = {
        blade: (abbr) => (this.classList = Parts.blade[abbr].attr.join(' ')) && this.lang(abbr, 'chi'),
        ratchet: (abbr) => this.Q('h4 span:nth-child(2)').title = abbr,
        bit: (abbr) => this.Q('h4 span:nth-child(3)').title = abbr
    }
    lang = (abbr, lang) => this.Q('h4 span:nth-child(1)').title = Parts.blade[abbr].names[lang];
    select = exec => this.classList.toggle('selected', exec)
    static classChangedCallback ([{target}]) {
        if (document.body.classList.contains('dragging')) return;
        Bey.selected?.classList.remove('selected');
        Bey.selected = target.classList.contains('selected') ? target : null;
    }
    static classObserver = Object.assign(new MutationObserver(Bey.classChangedCallback), {config: {attributeFilter: ['class']}});
    
    connectedCallback() {
        if (this.hasAttribute('pool')) return;
        this.onclick = () => this.classList.toggle('selected');
        if (this.hasAttribute('collapse')) return;
        Bey.classObserver.observe(this, Bey.classObserver.config);
        setTimeout(() => Bey.validate(this.deck = [...new Set([...this.neighbor('previous'), this, ...this.neighbor('next')])]));
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
    
    static validate(deck) {
        let parts = deck.flatMap(b => b.abbr);
        let unique = [...new Set(parts.map(pairs => pairs.join('#')))];
        let duplicated = unique.map(p => p.split('#')).filter(([c, p]) => parts.filter(([d, q]) => c === d && p === q).length > 1);
        deck.forEach(bey => bey.validate(duplicated));
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
        outline-color:var(--theme-alt);
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
        font-size:.7em; text-align:center;
        white-space:nowrap;
    }
    h4 span:nth-child(1):has(+span[title])::after {
        content:' '
    }
    h4 span:nth-child(2):has(+span[title])::after {
        content:' '
    }
    .duplicated {
        color:red;
    }
    :host-context(body[style]) [title]::before {
        padding-right:.2rem;
    }
    :host([collapse]) {
        grid-template-rows:0 min(calc((100vw - 2rem)/3),8em) 0;
        outline:.1em solid; outline-offset:-.1em;
    }
    :host([collapse]) :is(.rank,.spin) {
        align-self:start;
    }
    :host([collapse]) h4 {
        align-self:end;
    }
    `
}