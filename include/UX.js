class Dragging {
    constructor (el, {what, scroll, drop, holdToRedispatch, ...custom}) {
        this.scroll = scroll, this.drop = drop, this.holdToRedispatch = holdToRedispatch;
        el.onpointerdown = ev => (what && ev.target.matches(what) || !what) && this.press(ev, custom ?? {});
    }
    press (ev, {press, move, lift}) {
        this.mode = 
            !this.scroll && !this.drop ? 'drag' : 
            this.scroll?.when(ev) ? 'scroll' : this.drop?.when(ev) ? 'drop' : null;
        this.timer ??= this.holdTimer(ev, this.holdToRedispatch);
        if (!this.mode && !this.timer) return;
        this.mode != 'scroll' && (this.dragged = ev.target);
        this._press?.[this.mode]?.(ev);
        [this.pressX, this.pressY] = [ev.x, ev.y];
        press && (typeof press == 'object' ? press[this.mode] : press)?.(this, this.dragged);
        onpointermove = ev => this.move(ev, move);
        onpointerup = onpointercancel = () => this.lift(null, lift);
    }
    _press = {
        scroll: (ev) => {
            this.dragged = ev.target.closest(this.scroll.what);
            this.scrollInitX = this.dragged.scrollLeft;
        },
        drop: () => {
            this.targets = [this.drop.targets].flat().map(el => [Q(el)].flat());
            this.dragged.initial = Dragging.getBoundingPageRect(this.dragged);
            [this.scrollY, this.scrollInitY, this.limitY] = [0, scrollY, Q('aside')?.offsetTop];
            onscroll = () => this.move();
        }
    }
    move (ev, move) {
        ev && ([this.moveX, this.moveY] = [ev.x, ev.y]) && ev.stopPropagation();
        if (!this.dragged || Math.hypot(this.moveX-this.pressX, this.moveY-this.pressY) < 2) return;
        this.timer &&= clearTimeout(this.timer);
        this.dragged.classList.add('dragged');
        this._move?.[this.mode]?.(ev);
        move && (typeof move == 'object' ? move[this.mode] : move)?.(this, this.dragged);
    }
    _move = {
        scroll: () => this.dragged.scrollTo(this.scrollInitX - this.moveX + this.pressX, 0),
        drop: (ev) => {
            ev ? (this.clientY = ev.clientY) : (this.scrollY = this.dragged.closest('aside') ? 0 : scrollY - this.scrollInitY);
            let translate = [this.drop.x === false ? 0 : this.moveX-this.pressX, this.drop.y === false ? 0 : this.moveY-this.pressY+this.scrollY];
            this.drop.x == 'min' && (translate[0] = Math.max(0, translate[0]));
            this.dragged.style.transform = `translate(${translate[0]}px,${translate[1]}px)`;
            (this.drop.autoScroll || this.drop.autoScroll == null) && this.autoScroll();
            this.findTarget();
        }
    }
    lift (_, lift) {
        this.timer &&= clearTimeout(this.timer);
        if (lift) {
            (typeof lift == 'function' ? lift : Array.isArray(lift[this.mode]) ? 
                lift[this.mode][this.drop.targets.findIndex(t => this.targeted?.matches(t))] :
                lift[this.mode])?.(this, this.dragged, this.targeted);
            Array.isArray(lift[this.mode]) && lift[this.mode].all?.(this, this.dragged, this.targeted);
        }
        this.mode == 'drop' ? !this.targeted && this.to.return() : this.reset();
        onpointermove = onpointerup = onpointercancel = onscroll = null;
    }

    holdTimer = (ev, action) => action && setTimeout(() => {
        action(ev.target);
        onpointermove = onpointerup = onpointercancel = onscroll = null;
        ev.target.dispatchEvent(new MouseEvent('pointerdown', ev));
    }, 500);
    autoScroll () {
        let [proportion, bottomed] = [this.clientY / innerHeight, scrollY >= document.body.offsetHeight - innerHeight];
        proportion < .05 ? scrollBy(0, -3) : 
        proportion > .95 && !bottomed ? scrollBy(0, 3) : null;
    }
    findTarget () {
        this.targeted = null;
        let i = 0;
        if (!this.limitY || this.clientY <= this.limitY)
            while (i < this.targets.length && !this.targeted)
                this.targeted = this.targets[i++].find(el => el != this.dragged && Dragging.containsPointer(el, this.moveX, this.moveY));
        if (this.targeted?.matches('.targeted')) return;
        Q('.targeted')?.classList.remove('targeted');
        this.targeted?.classList.add('targeted');      
    }
    reset () {
        this.dragged?.classList.remove('dragged', 'selected');
        this.targeted?.classList.remove('targeted');
        this.dragged = this.targeted = this.mode = null;
    }

    static getBoundingPageRect = el => (({x, y}) => ({
        x: x + scrollX,
        y: y + scrollY,
    }))(el.getBoundingClientRect())
    static containsPointer = (el, moveX, moveY) => (({x, y, width, height}) => 
        moveX > x && moveY > y && moveX < x+width && moveY < y+height
    )(el.getBoundingClientRect())

    to = {
        swap: () => {
            if (!this.targeted) return;
            let {x, y} = Dragging.getBoundingPageRect(this.targeted);
            this.dragged.style.transform = `translate(${x - this.dragged.initial.x}px,${y - this.dragged.initial.y}px)`;
            this.targeted.style.transform = `translate(${this.dragged.initial.x - x}px,${this.dragged.initial.y - y}px)`;
            Dragging.commit.swap(this.dragged, this.targeted);
            Dragging.class.temp(document.body, 'animating');
            setTimeout(() => this.reset(), 500);
        },
        transfer: () => {
            this.to.return(false);
            this.targeted.append(this.dragged);
        },
        clone: () => {
            this.dragged.classList.remove('selected');
            this.to.return(false);
            this.targeted.append(this.dragged.cloneNode(true));
        },
        return: (animate = true) => {
            this.dragged.style.transform = null;
            if (!animate) return;
            Dragging.class.temp(document.body, 'animating');
            setTimeout(() => this.reset(), 500);
        }
    }
    static commit = {
        swap: (dragged, targeted) => setTimeout(() => {
            targeted.nextSibling || targeted.after('');
            let place = targeted.nextSibling;
            dragged.before(targeted);
            place.before(dragged);
            dragged.style.transform = targeted.style.transform = null;    
        }, 500)
    }

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
    get value() {return this.input.value;}
    set value(value) {this[this.type].adjustValue(value);}
    θ = () => parseFloat(getComputedStyle(this).getPropertyValue('--angle'));

    connectedCallback() {
        this.beforeChildren();
        setTimeout(() => this.afterChildren());
        new Dragging(this, {
            press: (drag) => drag.pressθ = this.θ,
            move: (drag) => {
                let delta = Math.abs(drag.moveY - drag.pressY);
                if (this.type == 'continuous' && delta < 2 || this.type == 'discrete' && delta < 50) return;
                this[this.type].getΔY(drag);
                this[this.type].adjustValue();
            },
        });
    }
    beforeChildren() {
        this.minθ = parseFloat(this.getAttribute('min')) || 15;
        this.maxθ = 360 - this.minθ;
        this.style.setProperty('--min', `${this.minθ}deg`);  
        this.style.setProperty('--angle', `${this.minθ}deg`); 
        this.callback = Function('Knob', this.getAttribute('callback')).bind(this);
    }
    afterChildren() {
        this.type = this.Q('option') ? 'discrete' : 'continuous';
        this.input = this.Q('meter,select');
        if (this.type == 'continuous')
            this.input || this.append(this.input = E('meter'));
        else {
            this.setAttribute('discrete', this.discrete.total = this.Q('option').length);
            this.shadowRoot.Q('style').textContent += `:host([discrete]) label {background:conic-gradient(${this.discrete.ticks()})}`;
        }
        this.input.onchange = () => this.event();
        this.input.dispatchEvent(new Event('change'));
    }
    discrete = {
        ticks () {
            let css = `transparent ${this.θ(0) - 1.5}deg,`;
            for (let i = 0; i < this.total; i++)
                css += `var(--dark) ${this.θ(i) - 1.5}deg ${this.θ(i) + 1.5}deg,
                        transparent ${this.θ(i) + 1.5}deg ${this.θ(i+1) - 1.5}deg,`;
            return css.replace(/,$/, '');
        },
        getΔY (drag) {
            this.index = Math.max(0, Math.min((this.index ?? 0) - Math.sign(drag.moveY - drag.pressY), this.total - 1));
            drag.pressY = drag.moveY;
        },
        adjustValue: (value) => {
            value && (this.discrete.index = this.Q('option').findIndex(o => o.value == value));
            if (this.discrete.index == null) return;
            this.Q(`option:nth-child(${this.discrete.index+1})`).selected = true;
            this.style.setProperty('--angle', `${this.discrete.θ()}deg`);
            this.input.dispatchEvent(new Event('change'));
        },
        θ: (x = this.discrete.index) => ((this.maxθ - this.minθ) / (this.discrete.total - 1))*x + this.minθ
    }
    continuous = {
        getΔY: (drag) => {
            drag.moveθ = Math.max(this.minθ, Math.min(drag.pressθ - (drag.moveY - drag.pressY), this.maxθ));
            (drag.moveθ == this.minθ || drag.moveθ == this.maxθ) && ([drag.pressY, drag.pressθ] = [drag.moveY, drag.moveθ]);
        },
        adjustValue: () => {
            this.style.setProperty('--angle', `${value}deg`);
            this.input.dispatchEvent(new Event('change'));
        }
    }
    event() {
        this.type == 'discrete' && (this.shadowRoot.Q('span').textContent = this.Q('option:checked').textContent);
        this.callback?.();
    }
    css = `
    :host {
        position:relative;
        font-size:2em;
        display:inline-block; width:2em; height:2em;
        touch-action:none; user-select:none;
    }
    ::slotted(:is(meter,select)) {
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
        border-radius:inherit; outline:.2em solid var(--bg,#333);
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
        user-select:none; -webkit-user-select:none; pointer-events:none;
        display:flex; justify-content:center; align-items:center;
        transform:scale(-1);
    }
    span {
        position:absolute; right:-.3em; bottom:.4em;
        font-size:.4em; color:var(--on);
    }`
}
customElements.define('spin-knob', Knob);
