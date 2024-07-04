class Dragging {
    constructor (el, {what, translate, scroll, drop, hold, click, ...custom}) {
        typeof el == 'string' && (el = Q(el));
        if (!el) return;
        this.what = what, this.translate = translate;
        this.scroll = scroll, this.drop = drop, this.hold = hold;
        this.scroll && (el.onwheel = ev => {
            let scrolled = ev.target.closest(this.scroll.what);
            scrolled && (ev.deltaY < 0 && scrolled.scrollLeft != 0 || ev.deltaY > 0 && scrolled.scrollLeft != scrolled.scrollWidth - scrolled.clientWidth)
                && (scrolled.scrollLeft += ev.deltaY > 0 ? 100 : -100) && ev.preventDefault();
        });
        this.fixedPostioned = Q('aside');
        click === false && el.addEventListener('click', ev => ev.preventDefault());
        el.addEventListener('pointerdown', ev => this.press(ev, custom ?? {}));
    }
    events = new Proxy(
        Object.defineProperty({}, 'remove', {value() {Object.entries(this).forEach(p => removeEventListener(...p))}, enumerable: false}),
        {set: (target, ...p) => addEventListener(...p) ?? Reflect.set(target, ...p)} //window
    )
    press (ev, {press, move, lift}) {
        this.mode = 
            !this.scroll && !this.drop ? 'drag' : 
            this.scroll?.when(ev) ? 'scroll' : this.drop?.when(ev) ? 'drop' : null;
        this.timer ??= this.holdTimer(ev, this.hold);
        if (!this.mode && !this.timer) return;
        this.dragged = ev.target.closest(this[this.mode]?.what || this.what || '*');
        this._press?.[this.mode]?.();
        [this.pressX, this.pressY] = [ev.x, ev.y];
        press && (typeof press == 'object' ? press[this.mode] : press)?.(this, this.dragged);
        this.events.pointermove = ev => this.move(ev, move);
        this.events.pointerup = this.events.pointercancel = () => this.lift(null, lift);
    }
    _press = {
        scroll: () => this.scrollInitX = this.dragged.scrollLeft,
        drop: () => {
            this.targets = [this.drop.targets].flat().map(el => [Q(el)].flat());
            this.dragged.initial = Dragging.getBoundingPageRect(this.dragged);
            this.scrollInitY = scrollY;
            this.events.scroll = () => this.move();
        }
    }
    move (ev, move) {
        ev && ([this.moveX, this.moveY, this.deltaX, this.deltaY] = [ev.x, ev.y, ev.x-this.pressX, ev.y-this.pressY]) && ev.preventDefault();
        if (!this.dragged || Math.hypot(this.deltaX, this.deltaY) < 5) return;
        this.timer &&= clearTimeout(this.timer);
        if (!this.mode) return;
        this.dragged.classList.add('dragged');
        this.translate !== false && this.mode != 'scroll' && this._move.move(ev);
        this._move?.[this.mode]?.(ev);
        move && (typeof move == 'object' ? move[this.mode] : move)?.(this, this.dragged, this.targeted);
    }
    _move = {
        scroll: (ev) => ev.pointerType == 'mouse' && this.dragged.scrollTo(this.scrollInitX - this.deltaX, 0),
        move: (ev) => {
            ev || this.fixedPostioned?.contains(this.dragged) || (this.scrollY = scrollY - this.scrollInitY); //update value only when
            let x = this.translate?.x === false ? 0 : this.deltaX;
            let y = this.translate?.y === false ? 0 : this.deltaY + (this.scrollY ?? 0);
            let min = typeof this.translate?.x?.min == 'function' ? this.translate.x.min(this.dragged) : this.translate?.x?.min ?? -Infinity;
            let max = typeof this.translate?.x?.max == 'function' ? this.translate.x.max(this.dragged) : this.translate?.x?.max ?? Infinity;
            this.dragged.style.transform = `translate(${Math.max(min, Math.min(x, max))}px,${y}px)`;
        },
        drop: () => {
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
        this.dragged?.classList.remove('dragged');
        this.mode == 'drop' ? !this.targeted && this.to.return() : this.reset();
        this.events.remove();
    }

    holdTimer = (ev, action) => action && setTimeout(() => {
        action.to(ev.target);
        this.events.remove();
        action.redispatch && ev.target.dispatchEvent(new MouseEvent('pointerdown', ev));
    }, 500);
    autoScroll () {
        let [proportion, bottomed] = [this.moveY / innerHeight, scrollY + innerHeight >= document.body.offsetHeight + 250];
        proportion < .05 ? scrollBy(0, -4) : 
        proportion > .95 && !bottomed ? scrollBy(0, 4) : null;
    }
    findTarget () {
        this.targeted = null;
        let i = 0;
        if (!Dragging.containsPointer(this.fixedPostioned, this.moveX, this.moveY))
            while (i < this.targets.length && !this.targeted)
                this.targeted = this.targets[i++].find(el => el != this.dragged && Dragging.containsPointer(el, this.moveX, this.moveY));
        if (this.targeted?.matches('.targeted')) return;
        Q('.targeted')?.classList.remove('targeted');
        this.targeted?.classList.add('targeted');      
    }
    reset () {
        this.dragged?.classList.remove('selected');
        this.targeted?.classList.remove('targeted');
        this.dragged = this.targeted = this.mode = null;
        this.scrollY = 0;
    }

    static getBoundingPageRect = el => (({x, y}) => ({
        x: x + scrollX,
        y: y + scrollY,
    }))(el.getBoundingClientRect())
    static containsPointer = (el, moveX, moveY) => el && (({x, y, width, height}) => 
        moveX > x && moveY > y && moveX < x+width && moveY < y+height
    )(el.getBoundingClientRect())

    to = {
        select: (boundary) => {
            this.dragged.Q('.selected')?.classList.remove('selected');
            [...this.dragged.children].find(li => !li.matches(':has(.current),:last-child') &&
                (({x, width}) => Math.round(x) <= boundary && x+width >= boundary)(li.getBoundingClientRect())
            )?.classList.add('selected');
        },
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
            this.targeted.append(this.dragged, '');
        },
        clone: () => {
            this.dragged.classList.remove('dragged', 'selected');
            this.to.return();
            this.targeted.append(this.dragged.cloneNode(true), '');
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
        this.attachShadow({mode: 'open'}).append(E('div', [E('slot')]), E('span'), E('style', this.css));
    }
    get value() {return this.input.value;}
    set value(value) {this[this.type].adjustValue(value);}
    set alt(alt) {this.setAttribute('alt', alt);}
    θ = () => parseFloat(getComputedStyle(this).getPropertyValue('--angle'));
    auto = ev => this.style.setProperty('--angle', `${ev.type == 'pointerenter' ? this.maxθ : this.minθ}deg`)
    hover = a => this.classList[a]('hover') ?? ['pointerenter', 'pointerout'].forEach(t => this[`${a}EventListener`](t, this.auto))
    
    connectedCallback() {
        this.beforeChildren();
        setTimeout(() => this.afterChildren());

        new Dragging(this, {
            translate: false,
            press: (drag) => (drag.pressθ = this.θ(), Dragging.start ??= drag.pressθ),
            move: (drag) => {
                let delta = Math.abs(drag.deltaY);
                if (this.type == 'continuous' && delta < 2 || this.type == 'discrete' && delta < 50) return;
                location.pathname == '/' && this.hasAttribute('alt') && Math.abs(this.θ() - Dragging.start) >= (this.maxθ - this.minθ)/2
                    && (this.Q('a').href = this.getAttribute('alt')) && this.shadowRoot.Q('div').classList.add('dragged');
                location.pathname == '/' && this.hover('remove');
                this[this.type].getΔY(drag);
                this[this.type].adjustValue();
            },
            lift: () => Dragging.start = null
        });
    }
    beforeChildren() {
        location.pathname == '/' && this.hover('add');
        this.minθ = parseFloat(this.getAttribute('min')) || 30;
        this.maxθ = 360 - this.minθ;
        this.style.setProperty('--min', `${this.minθ}deg`);  
        this.style.setProperty('--angle', `${this.minθ}deg`); 
    }
    afterChildren() {
        this.type = this.Q('option') ? 'discrete' : 'continuous';
        this.input = this.Q('input,select');
        this[this.type].setup();
        (this.input.onchange = ev => this.event(ev))();
    }
    discrete = {
        setup: () => {
            this.setAttribute('discrete', this.discrete.total = this.Q('option').length);
            this.shadowRoot.Q('style').textContent += `:host([discrete]) div {background:conic-gradient(${this.discrete.ticks()})}`;
        },
        ticks () {
            let css = `transparent ${this.θ(0) - 1.5}deg,`;
            for (let i = 0; i < this.total; i++)
                css += `var(--dark) ${this.θ(i) - 1.5}deg ${this.θ(i) + 1.5}deg,
                        transparent ${this.θ(i) + 1.5}deg ${this.θ(i+1) - 1.5}deg,`;
            return css.replace(/,$/, '');
        },
        getΔY (drag) {
            this.index = Math.max(0, Math.min((this.index ?? 0) - Math.sign(drag.deltaY), this.total - 1));
            drag.pressY = drag.moveY;
        },
        adjustValue: (value) => {
            this.discrete.index ??= this.Q('option').findIndex(o => o.value == value); //by assigning
            if (this.discrete.index == null) return;
            this.Q(`option:nth-child(${this.discrete.index+1})`).selected = true;
            this.style.setProperty('--angle', `${this.discrete.θ()}deg`);
            this.input.dispatchEvent(new Event('change'));
        },
        θ: (x = this.discrete.index) => (this.maxθ-this.minθ) / (this.discrete.total-1) * x + this.minθ
    }
    continuous = {
        setup: () => {
            this.input || this.append(this.input = E('input', {type: 'range', min: 0, max: 100, step: 'any'}));
            this.max = parseFloat(this.input.max), this.min = parseFloat(this.input.min);
        },
        getΔY: (drag) => {
            this.continuous.θ = drag.moveθ = Math.max(this.minθ, Math.min(drag.pressθ - (drag.deltaY), this.maxθ));
            (drag.moveθ == this.minθ || drag.moveθ == this.maxθ) && ([drag.pressY, drag.pressθ] = [drag.moveY, drag.moveθ]);
            this.input.value = (drag.moveθ - this.minθ) / (this.maxθ - this.minθ) * (this.max - this.min) + this.min;
        },
        adjustValue: (value) => {
            if (typeof value == 'string') { //by assigning
                this.input.value = parseFloat(value);
                value = (parseFloat(value) - this.min) / (this.max - this.min) * (this.maxθ - this.minθ) + this.minθ;
            } 
            this.style.setProperty('--angle', `${value ?? this.continuous.θ}deg`);
            this.input.dispatchEvent(new Event('change'));
        }
    }
    event(ev) {
        this.type == 'discrete' && (this.shadowRoot.Q('span').textContent = this.Q('option:checked').textContent);
        this.onchange?.(ev);
    }
    css = `
    :host {
        position:relative;
        font-size:2em;
        display:inline-block; width:2em; height:2em;
        touch-action:none; user-select:none; -webkit-user-select:none;
    }
    div,div::before,slot {
        width:100%; height:100%;
    }
    div {
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

        &.dragged {
            --theme:var(--theme-alt); color:hsl(45,90%,48%); --dark:hsl(45,90%,20%);
        }
        &::before {
            content:'';
            position:absolute; left:0;
            border-radius:inherit; 
            background:conic-gradient(
                transparent var(--min),
                var(--light) var(--min) var(--angle),
                transparent var(--angle)
            );
            filter:drop-shadow(0 0 .1em var(--light));
        }
        &::after {
            content:'·';
            position:absolute; inset:.3em;
            border-radius:inherit; outline:.2em solid var(--bg,#333);
            background:var(--dark);
            text-align:center; line-height:.4;
            transform:rotate(var(--angle));
            text-shadow:0 0 .1em var(--theme); color:var(--theme);
        }
    }
    :host([discrete]) div::before {
        background:conic-gradient(
            transparent calc(var(--angle) - 1.5deg),
            var(--light) calc(var(--angle) - 1.5deg) calc(var(--angle) + 1.5deg),
            transparent calc(var(--angle) + 1.5deg)
        );
    }
    :host([discrete]) div::after {
        outline-width:.1em;
    }   
    :host(.hover),:host([discrete]) div::after {
        transition:--angle .5s;
        touch-action:initial;
    }
    slot {
        z-index:1;
        position:absolute; 
        pointer-events:none;
        display:flex; justify-content:center; align-items:center;
        transform:scale(-1);
    }
    ::slotted(a) {
        width:100% !important; height:100% !important;
        pointer-events:auto !important;
    }
    ::slotted(:is(input,select)) {
        display:none !important;
    }
    span {
        position:absolute; right:-.3em; bottom:.4em;
        font-size:.4em; color:var(--on);
    }`
}
customElements.define('spin-knob', Knob);
