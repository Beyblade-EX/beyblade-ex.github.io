class KeysAsString {
    constructor(obj) {Object.assign(this, obj);}
    [Symbol.toPrimitive] = type => type == 'string' && Object.keys(this).join('')
};
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
const Markup = (text, location) => text && Markup.items[location].reduce((text, [before, after]) => text.replace(before, after), text);
Markup.items = [
    [/_([^ ]{4,})/g,  '<sub class=long>$1</sub>'],
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

const Storage = (key, obj) => !obj ? 
    JSON.parse(localStorage[key] ?? 'null') : 
    localStorage[key] = typeof obj == 'object' ? JSON.stringify({...Storage(key), ...obj}) : obj;
    
export {KeysAsString, Mapping, Markup, Storage}