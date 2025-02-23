const Q = Node.prototype.Q = function(el, func) {
    let els = this.querySelectorAll?.(el) ?? document.querySelectorAll(el);
    return typeof func == 'function' ? els.forEach(func) : Array.isArray(func) || els.length > 1 ? [...els] : els[0];
}
Node.prototype.sQ = function(el) {return this.shadowRoot.Q(el);}
const O = class {
    constructor(...objs) {
        objs.forEach(obj => Object.assign(this, typeof obj[Symbol.iterator] == 'function' ? Object.fromEntries(obj) : obj));
    }
    [Symbol.iterator] = function* () {
        let content = Object.entries(this);
        for (let i = 0; i < content.length; i++)
            yield content[i];
    }
    url () {
        return new URLSearchParams([...this]).toString();
    }
    map (...transforms) {
        return new O(Object.fromEntries([...this].map(
            transforms.length === 1 ? transforms[0] : ([k, v]) => [transforms[0]?.(k) || k, transforms[1]?.(v) || v]
        )));
    }
    filter (filter) {
        return new O(Object.fromEntries([...this].filter(filter)));
    }
    prepend (...objs) {
        return objs.reduce((summed, o) => new O(summed).map(([k, v]) => [k, (o[k] ?? '') + v]), this);
    }
}
const E = (el, ...stuff) => {
    stuff = E.prop.already(...stuff);
    el == 'img' && stuff.assign({alt: stuff.src?.match(/([^/.]+)(\.[^/.]+)$/)?.[1], onerror: ev => ev.target.remove()});
    el = ['svg', 'use', 'path'].includes(el) ? document.createElementNS('http://www.w3.org/2000/svg', el) : document.createElement(el);
    return stuff.apply(el);
}
Object.assign(E, {
    ul: lis => E('ul', lis.filter(li => li).map(li => E('li', li))),
    dl: (obj, attr = {}) => E('dl', attr, [...new O(obj)].flatMap(([dt, dds]) => [E('dt', dt), ...[dds].flat().map(dd => E('dd', dd instanceof HTMLElement ? [dd] : dd))])),
    
    input: (...stuff) => (prop => E('label', [E('input', {...prop}), ...prop]))(E.prop.already(...stuff)),
    inputs: contents => contents.map(content => E.input(content)),

    radio: (...stuff) => E.input(...stuff, {type: 'radio'}),
    radios: contents => contents.map(content => E.radio(content)),
    
    checkbox: (...stuff) => E.input(...stuff, {type: 'checkbox'}),
    checkboxes: contents => contents.map(content => E.checkbox(content)),
});
E.prop = class extends Array {
    constructor(...stuff) {
        let {true: objs, false: others} = Object.groupBy(stuff, s => Object.prototype.toString.call(s).includes('Object'));
        super(...(others?.filter(o => o) ?? []).flat(9));
        this.assign(...objs?.filter(o => o) ?? []);
        return new Proxy(this, this);
    }
    get (_, prop) {
        let value = this[prop];
        if (E.prop.nested.includes(prop)) delete this[prop];
        return value;
    }
    assign (...objs) {
        return Object.assign(this, ...objs);
    }
    apply (el) {
        el.append(...this);
        E.prop.nested.forEach(attr => Object.assign(el[attr], this[attr] ?? {}));
        Array.isArray(this.classList) && (this.classList = this.classList.filter(c => c).join(' '));
        return Object.assign(el, {...this});
    }
    static nested = ['dataset', 'style'];
    static already (...stuff) {
        let {true: already, false: others} = Object.groupBy(stuff, s => s instanceof E.prop);
        return already ? already[0].assign(...others ?? []) : new E.prop(...stuff);
    }
}

Q('head').insertAdjacentHTML('beforeend', `<style id=unsupported>
    html::before {
        content:'請重新整理\\A如問題持續，需更新／換瀏覽器';
        opacity:1;
        animation:show .5s 1.5s forwards;
        z-index:1;
        background:black; color:black; font-size:3em;
        white-space:pre-wrap;
        position:fixed; width:100%; height:100%;
        display:flex; justify-content:center; align-items:center;
    }
    @keyframes show {to {color:white;}}
    </style>`);
navigator.serviceWorker?.register('/worker.js').then(() => {
    if (!Q('link[href$="common.css"]')) return Promise.reject();
    document.title += ' ■ 戰鬥陀螺 X⬧爆旋陀螺 X⬧ベイブレード X⬧Beyblade X';
    Q('#unsupported')?.remove();
});

addEventListener('DOMContentLoaded', () => {
    let menu = Q('nav menu');
    if (menu) {
        menu.append(E('li', [E('a', {href: '/', dataset: {icon: ''}} )] ));
        let hashchange = () => {
            Q('menu .current')?.classList.remove('current');
            Q('menu li a')?.find(a => new URL(a.href, document.baseURI).href == location.href)?.classList.add('current');
        };
        addEventListener('hashchange', hashchange);
        hashchange();
        new Dragging(menu, {
            what: 'nav menu',
            translate: {x: {max: menu => menu.offsetLeft*-1 - 6}, y: false},
            move: drag => drag.to.select(0),
            lift (drop, dragged) {
                dragged.Q('.selected') && (location.href = dragged.Q('.selected a').href);
                drop.to.return();
            }
        });
        setTimeout(() => Q('nav').classList.add('safari'), 200);
    }
    Q('[popover]')?.addEventListener('click', ev => ev.target.closest('[popover]').hidePopover());
});
const Storage = (key, obj) => !obj ? 
    JSON.parse(localStorage[key] ?? 'null') : 
    localStorage[key] = typeof obj == 'object' ? JSON.stringify({...Storage(key), ...obj}) : obj;

const doubletap = (ev, timestore, actionORtarget) => {
    let now = new Date().getTime();
    if (now - timestore.lastTap < 500) {
        ev.preventDefault();
        typeof actionORtarget == 'function' ? actionORtarget(ev) : (actionORtarget || timestore).dispatchEvent(new Event('dblclick'));
    } 
    timestore.lastTap = now;
}
class Mapping {
    constructor(...map) {
        this.default = map.length % 2 ? map.pop() : null;
        this.map = new Map(map.flatMap((item, i, ar) => i % 2 ? [] : [[item, ar[i + 1]]]));
    }
    find = (...keys) => {
        let found, evaluate = typeof keys.at(-1) == 'boolean' && keys.pop();
        let key = keys.find(key => (found = 
            [...this.map.entries()].find(([k]) =>
                k instanceof RegExp && k.test(key) || k instanceof Array && k.find(item => item == key) ||
                k instanceof Function && k(key) || k == key
            )?.[1] ?? this.default
        ) != null);
        if (found instanceof Function)
            return evaluate ? found(key) : found;
        if (found instanceof Array)
            return found.map(item => typeof item == 'string' ? item.replaceAll('${}', key) : (item ?? ''));
        return found && typeof found == 'string' ? found.replaceAll('${}', key) : (found ?? '');
    }
    static maps = {};
}
class KeysAsString {
    constructor(obj) {Object.assign(this, obj);}
    [Symbol.toPrimitive] = type => type == 'string' && Object.keys(this).join('')
};
const Markup = (text, location) => text && Markup.items[location].reduce((text, [before, after]) => text.replace(before, after), text);
Markup.items = [
    [/_([^ ]{4,})/g, '<sub class=long>$1</sub>'],
    [/_([^ ]+)/g, '<sub>$1</sub>'],
];
Markup.items.products = [...Markup.items,
    [/ (?=[一-龢])/, '⬧'],
    [/(?<!<)[\/\\]/g, ''],
];
Markup.items.parts = [...Markup.items, 
    [/([^<]+)\\([^<]+)/, '$1<span>$2</span>'],
    [/([^<]+)\/([^<]+)/, '<span>$1</span>$2'],
    [/^([一-龢]{2})([一-龢]{2,})/, '<span>$1</span>$2'],
    [/^[^</\\]+?(?=[A-Z])/, '<span>$&</span>']
];
Markup.sterilize = text => text.replaceAll(/[_\/\\]/g, '');
