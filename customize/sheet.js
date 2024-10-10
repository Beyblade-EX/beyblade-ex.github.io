const MAIN = {}
MAIN.can = Q('canvas');
MAIN.con = MAIN.can.getContext('2d', { alpha: false });

const App = () => {
    Controls.show(null);
    Q('form button', button => button.type = 'button');
    App.events();
    //App.picker();
    Layers.frame = Images.load('./frame.png').then(img => {
        MAIN.W = MAIN.can.width = img.naturalWidth, MAIN.H = MAIN.can.height = img.naturalHeight;
        MAIN.hW = MAIN.W/2, MAIN.hH = MAIN.H/2;
        Layers.frame = img;
        Draw();
        Q('#layer div').append(Layers.label());
        Layers.labels.length === 1 && Layers.labels[0].click();
    });
}
App.events = () => {
    Object.assign(Q('#layer'), {
        onchange: Layers.change,
        onclick: ev => ev.target.id == 'create' ? Layers.create(ev) : ['up', 'down'].includes(ev.target.id) ? Layers.move(ev) : null,
        onpointerdown: ev => ev.target.id == 'delete' && Layers.delete(ev)
    });
    Object.assign(Q('#control-image'), {
        onchange: Controls.image,
        onclick: ev => ev.target.popoverTargetElement && (ev.preventDefault(), Q('aside').showPopover())
    });
    Object.assign(Q('#control-color'), {
        oninput: ev => ev.target.type == 'color' && Controls.get(ev),
        onchange: Controls.get
    });
    Q('#type').onclick = ev => ev.target.tagName == 'BUTTON' && Controls.chooseType(ev);
    Q('#control').onchange = Controls.get;
    
    Q('#export').onclick = Layers.export;
    Q('#import').onchange = Layers.import;
    Q('#download').onclick = App.download;
}
App.download = () => {
    let document, page;
    PDFLib.PDFDocument.create().then(doc => {
        document = doc;
        page = doc.addPage(PDFLib.PageSizes.A4.sort((a, b) => b - a));
        return doc.embedPng(MAIN.can.toDataURL("image/png", 1.0));
    }).then(image => {
        let scaled = image.scale(.2427);
        for (let i = 0; i < Q('input[type=number]').value; i++)
            page.drawImage(image, {
                x: 84.5 + i % 2 * (20 + scaled.width),
                y: 488 - Math.floor(i / 2) * (12.5 + scaled.height),
                width: scaled.width,
                height: scaled.height,
            });
        return document.save();
    }).then(doc => window.open(URL.createObjectURL(new Blob([doc], { type: 'application/pdf' }))))
    .catch(er => console.error(er));
}
const Controls = {
    show (what) {
        Q('#type,[id|=control]', fieldset => fieldset.hidden = true);
        what === 0 ? Q('#type').hidden = false : what && Q(`#control,#control-${what}`, fieldset => fieldset.hidden = false);  
    },
    reset () {
        Q('input[type=color]', input => input.value = '#000000');
        Q('input[value=Linear]').checked = true;
        Q('spin-knob', knob => knob.init());
    },
    put () {
        let {type, ...controls} = Layers.selected.dataset;
        Controls.reset();
        Controls.show(type);
        Object.entries(controls).forEach(([n, v]) => Q(`spin-knob:has(input[name=${n}]),input[name=${n}]:not([type=range])`).value = v);
    },
    get (ev) {
        if (!Layers.selected) return;
        Layers.selected.dataset[ev.target.name] = ev.target.value;
        Draw();
    },
    image (ev) {
        Q('#layer').disabled = true;
        const reader = new FileReader();
        reader.readAsDataURL(ev.target.files[0]);
        reader.onload = () => Images.load(reader.result).then(img => {
            Layers.selected.img = img;
            Layers.selected.Q('span,img').replaceWith(img);
            Q('#layer').disabled = false;
            Draw();
        });  
    },
    chooseType (ev) {
        Layers.selected.dataset.type = ev.target.id;
        Layers.selected.Q('span').textContent = ev.target.textContent;
        Controls.show(ev.target.id);
    }
}
const Images = new Map();
Images.load = src => new Promise(res => E('img', {src, onload: function() {res(this);}}));

const Layers = {
    labels: Q('#layer div').children,
    label: (dataset, img) => {
        let label = E('label', {dataset}, [img ?? E('span'), E('input', {type: 'radio', name: 'layer'})]);
        label.can = MAIN.can.cloneNode();
        label.con = label.can.getContext('2d');
        img && (label.img = img);
        return label;
    },
    change (ev) {
        Q('#delete').disabled = Layers.labels.length === 1;
        Layers.selected = ev.target.parentElement;
        Layers.selected.dataset.type ? Controls.put() : Controls.show(0);
    },
    create (ev) {
        let label = Layers.label();
        Layers.labels[0].before(label);
        label.click();
        Q('#delete').disabled = false;
        Controls.reset();
        Controls.show(0);
    },
    delete (ev) {
        Q('form .message').hidden = false;
        setTimeout(() => Q('form .message').hidden = true, 2000);
        let timer = setTimeout(() => {
            Layers.selected.remove();
            Layers.labels[0].click();
        }, 2000);
        ev.target.onpointerup = () => clearTimeout(timer);
    },
    move (ev) {
        let current = Layers.selected;
        let sibling = current[`${ev.target.id == 'up' ? 'previous' : 'next'}ElementSibling`];
        sibling.tagName == 'LABEL' && sibling[ev.target.id == 'up' ? 'before' : 'after'](current);
        Draw();
    },
    export () {
        let layers = [...Layers.labels]
            .map(label => ({...label.dataset, ...label.img ? {image: label.img.src} : {}}))
            .filter(obj => Object.keys(obj).length);
        E('a', {
            href: `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(layers))}`,
            download: 'sheet.json'
        }).click();
    },
    import (ev) {
        let reader = new FileReader();
        reader.readAsText(ev.target.files[0]);
        reader.onload = () =>
            Promise.all(JSON.parse(reader.result).map(ds => ds.image ? 
                Images.load(ds.image).then(img => Layers.label((({image, ...others}) => others)(ds), img)) : 
                Layers.label(ds)
            )).then(labels => {
                Q('#layer div').replaceChildren(...labels);
                labels[0].click();
                Draw(true);
            });
    }
};
const Draw = (all) => {
    Draw.clear();
    [...Layers.labels].reverse().forEach(label => {
        if (all || Layers.selected === label) {
            label.img && Draw.image(label);
            label.dataset.type == 'color' && Draw.color(label);
        }
        MAIN.con.drawImage(label.can, 0, 0);
    });
    Draw.frame();
}
Object.assign(Draw, {
    clear: context => context ? context.clearRect(0, 0, MAIN.W, MAIN.H) : (MAIN.con.fillStyle = 'white') && MAIN.con.fillRect(0, 0, MAIN.W, MAIN.H),
    frame: () => MAIN.con.drawImage(Layers.frame, 0, 0, MAIN.W, MAIN.H),
    transform (con, s, p, angle, x, y, image) {
        s ??= 1, p ??= 1, angle ??= 0, x ??= 0, y ??= 0;
        let drawing = {W: image?.naturalWidth ?? MAIN.W, H: image?.naturalHeight ?? MAIN.W};
        drawing.hW = drawing.W/2, drawing.hH = drawing.H/2;

        let cos = Math.cos(angle*Math.PI), sin = Math.sin(angle*Math.PI);
        x = -x * (MAIN.hW + drawing.hW) - MAIN.hW;
        y = y * (MAIN.hH + drawing.hH) - MAIN.hH;
        con.setTransform(s*cos, s*p*sin, -s*sin, s*p*cos, x*s*cos-y*s*sin-x, x*s*p*sin+y*s*p*cos-y);
        return { x: -x - drawing.hW, y: -y - drawing.hH };
    },
    image (label) {
        let {img, con, dataset: {angle, x, y, scale: s, pull: p, opacity}} = label;
        con.save();
        Draw.clear(con);
        ({x, y} = Draw.transform(con, s, p, angle, x, y, img));
        con.globalAlpha = opacity ?? 1;
		con.drawImage(img, Math.round(x), Math.round(y));
        con.restore();
    },
    color (label) {
        let {con, dataset: {gradient: type, angle, x, y, scale: s, pull: p, opacity}} = label;
        con.save();
        Draw.clear(con);
        ({x, y} = Draw.transform(con, s, p, angle, x, y));

        type ??= 'Linear';
        let gradient = 
            type == 'Linear' ?
                con.createLinearGradient(x, 0, x + MAIN.W, 0) :
            type == 'Radial' ?
                con.createRadialGradient(x + MAIN.hW, y + MAIN.hW, 0, x + MAIN.hW, y + MAIN.hW, MAIN.hW) :
            type == 'Conic' ?
                con.createConicGradient(-Math.PI/2, x + MAIN.hW, y + MAIN.hW) : null;

        let colors = [1,2,3].map(i => Draw.color.format(label.dataset[`color${i}`], label.dataset[`opacity${i}`])).filter(c => c);
        (colors.length === 1 || type == 'Conic') && colors.push(colors[0]);
        colors.forEach((c, i, ar) => gradient.addColorStop(i / (ar.length - 1), c));
        label.style.background = `${type}-gradient(${colors.join(',')}),white`;

        con.globalAlpha = opacity ?? 1;
        con.fillStyle = gradient;
        con.fillRect(Math.round(x), Math.round(y), MAIN.W, MAIN.W);
        con.restore();

        label.Q('span').textContent = '';
    }
}); 
Draw.color.format = (color, opacity) => color ? `rgba(${color.replaceAll(/[^#]{2}/g, c => parseInt(c, 16) + ',').substring(1)}${opacity ?? 1})` : null;