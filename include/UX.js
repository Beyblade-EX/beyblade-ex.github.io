class Dragging {
    constructor (el, {what, scroll, drop, ...custom}) {
        this.scroll = scroll, this.drop = drop, this.custom = custom;
        el.onpointerdown = ev => (what && ev.target.matches(what) || !what) && this.press(ev, custom);
    }
    press (ev, custom) {
        this.mode = 
            !this.scroll && !this.drop ? 'drag' : 
            this.scroll?.when(ev) ? 'scroll' : this.drop?.when(ev) ? 'drop' : null;
        if (!this.mode) return;
        this.mode != 'scroll' && (this.dragged = ev.target);
        this._press[this.mode]?.(ev);
        [this.pressX, this.pressY] = [ev.x, ev.y];
        (typeof custom?.press == 'object' ? custom?.press?.[this.mode] : custom?.press)?.(this, this.dragged);
        onpointermove = ev => this.move(ev, custom?.move);
        onpointerup = onpointercancel = () => this.lift(null, custom?.lift);
    }
    _press = {
        scroll: (ev) => {
            this.dragged = ev.target.closest(this.scroll.what);
            this.scrollInitX = this.dragged.scrollLeft;
        },
        drop: (ev) => {
            this.dragged.origin = Dragging.getBoundingPageRect(this.dragged);
            [this.scrollY, this.scrollInitY] = [0, scrollY];
            onscroll = () => this.move();
        }
    }
    move (ev, custom) {
        ev && ([this.moveX, this.moveY] = [ev.x, ev.y]);
        if (Math.hypot(this.moveX-this.pressX, this.moveY-this.pressY) < 2) return;
        ev?.preventDefault();
        this.dragged.classList.add('dragged');
        this._move[this.mode]?.(ev);
        (typeof custom == 'object' ? custom?.[this.mode] : custom)?.(this, this.dragged);
    }
    _move = {
        scroll: () => this.dragged.scrollTo(this.scrollInitX - this.moveX + this.pressX, 0),
        drop: (ev) => {
            ev ? (this.clientY = ev.clientY) : (this.scrollY = this.dragged.closest('aside') ? 0 : scrollY - this.scrollInitY);
            let translate = [this.moveX - this.pressX, this.moveY - this.pressY + this.scrollY];
            this.drop.x == 'min' && (translate[0] = Math.max(0, translate[0]));
            this.dragged.style.transform = `translate(${this.drop.x === false ? '0' : translate[0]}px,${this.drop.y === false ? '0' : translate[1]}px)`;
            (this.drop.autoScroll || this.drop.autoScroll == null) && this.autoScroll();
            this.findTarget();
        }
    }
    lift (_, custom) {
        this._lift[this.mode]?.();
        (typeof custom == 'object' ? custom?.[this.mode] : custom)?.(this, this.dragged, this.targeted);
        this.mode != 'drop' && this.reset();
        onpointermove = onpointerup = onpointercancel = onscroll = null;
    }
    _lift = {
        drop: () => {
            Dragging.class.temp(document.body, 'animating');
            setTimeout(() => this.reset(), 500);
        }
    }
    autoScroll () {
        let [proportion, bottomed] = [this.clientY / innerHeight, scrollY >= document.body.offsetHeight - innerHeight];
        proportion < .05 ? scrollBy(0, -3) : 
        proportion > .95 && !bottomed ? scrollBy(0, 3) : null;
    }
    findTarget () {
        this.targeted = this.clientY > Q('aside')?.offsetTop ? null : Q(this.drop.targets).find(el => el != this.dragged && Dragging.containsPointer(el, this.moveX, this.moveY));
        if (this.targeted?.matches('.targeted')) return;
        Q('.targeted')?.classList.remove('targeted');
        this.targeted?.classList.add('targeted');      
    }
    reset () {
        this.dragged.classList.remove('dragged', 'selected');
        this.targeted?.classList.remove('targeted');
    }

    static getBoundingPageRect = el => (({x, y, width, height}) => ({
        x: x + scrollX,
        y: y + scrollY,
        width, height
    }))(el.getBoundingClientRect())
    static containsPointer = (el, moveX, moveY) => (({x, y, width, height}) => 
        moveX > x && moveY > y && moveX < x+width && moveY < y+height
    )(el.getBoundingClientRect())

    static class = {
        temp (el, cl, t)  {
            el = typeof el == 'string' ? Q(el) : el;
            el.classList.add(cl);
            setTimeout(() => el.classList.remove(cl), t ?? 500);
        },
        switch (el, cl) {
            el = typeof el == 'string' ? Q(el) : el;
            el.parentElement.Q(`.${cl}`).classList.remove(cl);
            el.classList.add(cl);
        }
    }
}

class Knob extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({mode: 'open'}).append(E('label', [E('slot', {name: 'knob'})]), E('span'), E('style', this.css));
    }
    get value() {return this.Q('input,select').value;}
    connectedCallback() {
        this.beforeChildren();
        setTimeout(() => this.afterChildren());
        new Dragging(this, {
            press: (self, dragged) => self.pressθ = dragged.currentθ(),
            move: (self, dragged) => {
                if (Math.abs(self.moveY - self.pressY) < 2) return;    
                this.Q('select') ? this.discrete(self, dragged) : this.continuous(self, dragged);
            },
        });
    }
    beforeChildren() {
        this.minθ = parseFloat(this.getAttribute('min')) || 15;
        this.maxθ = 360 - this.minθ;
        this.style.setProperty('--min', `${this.minθ}deg`);  
        this.style.setProperty('--angle', `${this.minθ}deg`); 
        this.callback = new Function('Knob', this.getAttribute('callback')).bind(this);
    }
    afterChildren() {
        if (!this.Q('option'))
            this.append(E('input', {type: 'range'}));
        else {
            this.setAttribute('discrete', this.n = this.Q('option').length);
            this.shadowRoot.Q('style').textContent += `:host([discrete]) label {background:conic-gradient(${this.gradient()})}`;
        }
        this.Q('input,select').onchange = () => this.event();
        this.Q('select').dispatchEvent(new Event('change'));
    }
    gradient() {
        let css = `transparent ${this.discreteθ(0) - 1.5}deg,`;
        for (let i = 0; i < this.n; i++)
            css += `var(--dark) ${this.discreteθ(i) - 1.5}deg ${this.discreteθ(i) + 1.5}deg,
                    transparent ${this.discreteθ(i) + 1.5}deg ${this.discreteθ(i+1) - 1.5}deg,`;
        return css.replace(/,$/, '');
    }
    event() {
        this.Q('option') && (this.shadowRoot.Q('span').textContent = this.Q('option:checked').textContent);
        this.callback?.();
    }
    continuous(self) {
        self.moveθ = Math.max(this.minθ, Math.min(self.pressθ - (self.moveY - self.pressY), this.maxθ));
        (self.moveθ == this.minθ || self.moveθ == this.maxθ) && ([self.pressY, self.pressθ] = [self.moveY, self.moveθ]);
        this.style.setProperty('--angle', `${self.moveθ}deg`);
    }
    discrete(self) {
        if (Math.abs(self.moveY - self.pressY) < 50) return;
        this.x = Math.max(0, Math.min((this.x ?? 0) - Math.sign(self.moveY - self.pressY), this.n - 1));
        self.pressY = self.moveY;
        this.style.setProperty('--angle', `${this.discreteθ(this.x)}deg`);
        this.Q(`option:nth-child(${this.x+1})`).selected = true;
        this.Q('select').dispatchEvent(new Event('change'));
    }
    discreteθ = (x) => ((this.maxθ - this.minθ) / (this.n - 1))*x + this.minθ
    currentθ = () => parseFloat(getComputedStyle(this).getPropertyValue('--angle'));
    css = `
    :host {
        position:relative;
        font-size:2em;
        display:inline-block; width:2em; height:2em;
    }
    ::slotted(:is(input,select)) {
        display:none;
    }
    label,label::before,slot[name=knob] {
        width:100%; height:100%;
    }
    label {
        display:block; 
        --light:var(--theme); --dark:var(--theme-dark);
        border-radius:9em;
        background:conic-gradient(
            transparent var(--min),
            var(--light) var(--min) var(--angle),
            var(--dark) var(--angle) calc(360deg - var(--min)),
            transparent calc(360deg - var(--min))
        );
        transform:scale(-1);
        -webkit-user-drag:none;
    }
    label.dragged {
        --theme:var(--theme-alt); color:hsl(45,90%,48%); --dark:hsl(45,90%,20%);
    }
    label::before {
        content:'';
        position:absolute; left:0;
        border-radius:inherit; 
        background:conic-gradient(
            transparent var(--min),
            var(--light) var(--min) var(--angle),
            transparent var(--angle)
        );
        filter:drop-shadow(0 0 .05em var(--light));
    }
    :host([discrete]) label::before {
        background:conic-gradient(
            transparent calc(var(--angle) - 1.5deg),
            var(--light) calc(var(--angle) - 1.5deg) calc(var(--angle) + 1.5deg),
            transparent calc(var(--angle) + 1.5deg)
        );
    }
    label::after {
        content:'·';
        position:absolute; left:.3em; top:.3em;
        width:calc(-.6em + 100%); height:calc(-.6em + 100%);
        border-radius:inherit; outline:.2em solid #333;
        background:var(--dark);
        text-align:center; line-height:.4;
        transform:rotate(var(--angle));
        text-shadow:0 0 .1em var(--theme);
    }
    :host([discrete]) label::after {
        outline-width:.1em;
        transition:--angle .5s;
    }
    slot[name=knob] {
        z-index:1;
        position:absolute; 
        user-select:none; pointer-events:none;
        display:flex; justify-content:center; align-items:center;
        transform:scale(-1);
    }
    span {
        position:absolute; right:-.3em; bottom:.4em;
        font-size:.4em; color:var(--on);
    }`
}
customElements.define('spin-knob', Knob);