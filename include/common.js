document.querySelector('head').insertAdjacentHTML('beforeend', `<style id=unsupported>
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
    if (!document.querySelector('link[href$="common.css"]')) return Promise.reject();
    document.title += ' ■ 戰鬥陀螺 X⬧爆旋陀螺 X⬧ベイブレード X⬧Beyblade X';
    document.querySelector('#unsupported')?.remove();
}).catch(() => Storage('reloaded') < 3 && Storage('reloaded', Storage('reloaded') + 1) && location.reload());;

addEventListener('DOMContentLoaded', () => {
    Q('[popover]')?.addEventListener('click', ev => ev.target.closest('[popover]').hidePopover());
    let menu = Q('nav menu');
    if (!menu) return;
    menu.append(E('li', [E('a', {href: '/', dataset: {icon: ''}} )] ));
    let hashchange = () => {
        Q('menu .current')?.classList.remove('current');
        Q('menu li a')?.find(a => new URL(a.href, document.baseURI).href == location.href)?.classList.add('current');
    };
    addEventListener('hashchange', hashchange);
    hashchange();
    Q('body').append(E('script', `
        import {PointerInteraction} from 'https://aeoq.github.io/pointer-interaction/script.js';
        PointerInteraction.events({
            'nav menu': {
                drag: PI => {
                    PI.drag.to.translate({x: {max: Q('nav menu').offsetLeft*-1 - 6}, y: false });
                    PI.drag.to.select({x: 0}, [...PI.target.children].filter(child => !child.matches(':has(.current),:last-child')));
                },
                lift: PI => Q('.PI-selected') && (location.href = PI.target.Q('.PI-selected a').href)
            }
        })`, {type: 'module'}));
    setTimeout(() => Q('nav').classList.add('safari'), 200);
});
const Storage = (key, obj) => !obj ? 
    JSON.parse(localStorage[key] ?? 'null') : 
    localStorage[key] = typeof obj == 'object' ? JSON.stringify({...Storage(key), ...obj}) : obj;

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
