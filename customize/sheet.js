const CAN = {con: Q('canvas').getContext('2d', { alpha: false })};
const loadIMG = src => new Promise(res => E('img', {src, onload: function() {res(this);}}));
const App = () => {
    App.loading(true);
    Controls.show(null);
    Q('form button', button => button.type = 'button');
    App.events();
    loadIMG('./frame.png').then(img => {
        CAN.W = CAN.con.canvas.width = img.naturalWidth, CAN.H = CAN.con.canvas.height = img.naturalHeight;
        CAN.hW = CAN.W/2, CAN.hH = CAN.H/2;
        Layers.frame = img;
        App.load((location.hash ||= '#1').substring(1));
        App.loading(false);
    });
}
Object.assign(App, {
    reset () {
        Controls.reset();
        Q('#layers').replaceChildren(Layers.label());
        Layers.labels[0].click();
        Draw();
    },
    loading: loading => Q('.message').classList[loading ? 'add' : 'remove']('loading'),
    save: ev => (ev.target.disabled = true) && DB.put('user', {[`sheet-${location.hash.substring(1)}`]: Layers.get()}),
    load: no => {
	let staged = Q(`a[href='#${no}']`).canvas;
	staged ? 
	    CAN.con.drawImage(staged, 0, 0) : 
	    DB.get('user', `sheet-${no}`).then(layers => layers ? Layers.put(layers) : App.reset());
    },
    stage: hash => {
	let staged = Q(`a[href='${hash || location.hash}']`).canvas;
	(staged ??= CAN.con.canvas.cloneNode(true)).getContext('2d').drawImage(CAN.con.canvas, 0, 0);
    },
    switch: ev => {
        (Layers.labels.length > 1 || Layers.labels[0].dataset.type) && App.stage(new URL(ev.oldURL).hash);
        /^#[1-6]$/.test(location.hash) ? App.load(location.hash.substring(1)) : location.href = '#1';
    },
    export () {
        E('a', {
            href: `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(Layers.get()))}`,
            download: 'sheet.json'
        }).click();
    },
    import (ev) {
        let reader = new FileReader();
        reader.readAsText(ev.target.files[0]);
        reader.onload = () => Layers.put(JSON.parse(reader.result));
    },
    sample () {
        App.loading(true);
        fetch('./sample.json').then(resp => resp.json()).then(layers => {
            Layers.put(layers);
            App.loading(false);
        });    
    },
    download () {
        App.loading(true);
        App.stage();
        let pdf, page;
        PDFLib.PDFDocument.create().then(doc => {
            pdf = doc;
            page = doc.addPage(PDFLib.PageSizes.A4.sort((a, b) => a - b));
            return Promise.all(Q('nav li:not(:last-child) a')
		.map(a => a.canvas ? doc.embedPng(a.canvas.toDataURL("image/png", 1.0))) : null);
        }).then(images => {
            let amount = Q('#download+input').value;
            images.reverse().flatMap((im, i) => Array(parseInt(amount[i])).fill(im)).filter(im => im).forEach((image, i) => {
                let scaled = image.scale(.2427);
                page.drawImage(image, {
                    x: 20 + i % 6 * (12.5 + scaled.width),
                    y: 84.5 + (1 - Math.floor(i/6)) * (20 + scaled.height),
                    width: scaled.width, height: scaled.height,
                });
            });
            return pdf.save();
        }).then(doc => {
            window.open(URL.createObjectURL(new Blob([doc], { type: 'application/pdf' })))
            App.loading(false);
        }).catch(er => [Q('body').append(er), console.error(er)]);
    },
    events () {
        Object.assign(Q('#layer'), {
            onchange: Layers.change,
            onclick: ev => ev.target.id == 'create' ? Layers.create(ev) : ['up', 'down'].includes(ev.target.id) ? Layers.move(ev) : null,
            onpointerdown: ev => ev.target.id == 'delete' && Layers.delete(ev)
        });
        Object.assign(Q('#control-image'), {
            onchange: Controls.image,
            onclick: ev => {
		if (!ev.target.popoverTargetElement) return;
		Q('aside img') || App.picker();
		Q('aside').showPopover();
	    }
        });
        Object.assign(Q('#control-color'), {
            oninput: ev => ev.target.type == 'color' && Controls.get(ev),
            onchange: Controls.get
        });
        Q('#type').onclick = ev => ev.target.tagName == 'BUTTON' && Controls.chooseType(ev);
        Q('#control').onchange = Controls.get;
        
        Q('#export,#download,#sample', button => button.onclick = App[button.id]);
        Q('#import').onchange = App.import;

        Q('form').oncontextmenu = () => false;
        onkeydown = ev => ev.key == 'Control' ? Q('#fine').click() : null;

        Q('#save').onclick = App.save;
        onhashchange = App.switch;
        onbeforeunload = ev => Q('#save').disabled ? null : ev.preventDefault();
        //(onresize = () => [Q('#control :nth-child(2)').title, Q('#control :nth-child(3)').title] = innerWidth > innerHeight ? 
        //    ['上下', '左右'] : ['左右', '上下'])();
    }
});
const Controls = {
    show (what) {
        Q('#type,[id|=control]', fieldset => fieldset.hidden = true);
        what === 0 ? Q('#type').hidden = false : what && Q(`#control,#control-${what}`, fieldset => fieldset.hidden = false);  
    },
    reset () {
        Q('input[type=color]', input => input.value = '#000000');
        Q('input[value=Linear]').checked = true;
        Q('spin-knob', knob => knob.set());
    },
    put () {
        let {type, ...controls} = Layers.selected.dataset;
        Controls.reset();
        Controls.show(type);
        Object.entries(controls).forEach(([n, v]) => {
            Q(`spin-knob:has(input[name=${n}])`)?.set(v);
            Q('form')[n] && (Q('form')[n].value = v);
        });
    },
    get (ev) {
        if (ev.target.id == 'fine') 
            return Q('spin-knob', knob => knob.classList.toggle('fine', ev.target.checked));
        if (!Layers.selected || !ev.target.name) return;
        Layers.selected.dataset[ev.target.name] = ev.target.value;
        Draw();
    },
    image (ev) {
        Layers.fieldset.disabled = true;
        App.loading(true);
        const reader = new FileReader();
        try {
            reader.readAsDataURL(ev.target.files[0]);
            reader.onload = () => loadIMG(reader.result).then(img => {
                Layers.selected.img = img;
                Layers.selected.Q('span,img').replaceWith(img);
                Layers.fieldset.disabled = false;
                App.loading(false);
                Draw();
            });
        } catch(er) {
            console.error(er);
            Layers.fieldset.disabled = false;
            App.loading(false);
        }
    },
    chooseType (ev) {
        Layers.selected.dataset.type = ev.target.id;
        Layers.selected.Q('span').textContent = ev.target.textContent;
        Controls.show(ev.target.id);
    }
}
const Layers = {
    fieldset: Q('#layer'),
    labels: Q('#layers').children,
    label: (dataset, img) => {
        let label = E('label', {dataset}, [img ?? E('span'), E('input', {type: 'radio', name: 'layer'})]);
        label.can = new OffscreenCanvas(CAN.W, CAN.H);
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
        Q('.message').classList.add('active')
        setTimeout(() => Q('.active').classList.remove('active'), 2000);
        let timer = setTimeout(() => {
            Layers.selected.remove();
            Layers.labels[0].click();
            Draw();
        }, 2000);
        ev.target.onpointerup = () => clearTimeout(timer);
    },
    move (ev) {
        let current = Layers.selected, scrollTop = Layers.fieldset.scrollTop;
        let sibling = current[`${ev.target.id == 'up' ? 'previous' : 'next'}ElementSibling`];
        sibling?.tagName == 'LABEL' && sibling[ev.target.id == 'up' ? 'before' : 'after'](current);
        Layers.fieldset.scrollTop = scrollTop;
        Draw();
    },
    put (layers) {
        App.loading(true);
        Promise.all(layers.map(ds => ds.image ? 
            loadIMG(ds.image).then(img => Layers.label((({image, ...others}) => others)(ds), img)) : 
            Layers.label(ds)
        )).then(labels => {
            Q('#layers').replaceChildren(...labels);
            labels[0].click();
            Draw(true);
            App.loading(false);
        });
    },
    get: () => [...Layers.labels]
        .map(label => ({...label.dataset, ...label.img ? {image: label.img.src} : {}}))
        .filter(obj => Object.keys(obj).length)
};
const Draw = (all) => {
    Draw.clear();
    [...Layers.labels].reverse().forEach(label => {
        if (all || Layers.selected === label) {
            label.img && Draw.image(label);
            label.dataset.type == 'color' && Draw.color(label);
        }
        CAN.con.drawImage(label.can, 0, 0);
    });
    Draw.frame();
    Q('#save').disabled = all || Layers.labels.length <= 1 && !Layers.labels[0]?.dataset.type;
}
Object.assign(Draw, {
    clear: context => context ? context.clearRect(0, 0, CAN.W, CAN.H) : (CAN.con.fillStyle = 'white') && CAN.con.fillRect(0, 0, CAN.W, CAN.H),
    frame: () => CAN.con.drawImage(Layers.frame, 0, 0, CAN.W, CAN.H),
    transform (con, s, p, angle, x, y, image) {
        s ??= 1, p ??= 1, angle ??= 0, x ??= 0, y ??= 0;
        let drawing = {W: image?.naturalWidth ?? CAN.H, H: image?.naturalHeight ?? CAN.H};
        drawing.hW = drawing.W/2, drawing.hH = drawing.H/2;

        let cos = Math.cos(angle*Math.PI), sin = Math.sin(angle*Math.PI);
        x = -x * (CAN.hW + drawing.hW) - CAN.hW;
        y = y * (CAN.hH + drawing.hH) - CAN.hH;
        con.setTransform(s*cos, s*p*sin, -s*sin, s*p*cos, x*s*cos-y*s*sin-x, x*s*p*sin+y*s*p*cos-y);
        return { x: Math.round(-x - drawing.hW), y: Math.round(-y - drawing.hH) };
    },
    image (label) {
        let {img, con, dataset: {angle, x, y, scale: s, pull: p, opacity}} = label;
        Draw.clear(con);
        con.save();
        ({x, y} = Draw.transform(con, s, p, angle, x, y, img));
        con.globalAlpha = opacity ?? 1;
		con.drawImage(img, x, y);
        con.restore();
    },
    color (label) {
        let {con, dataset: {gradient: type, angle, x, y, scale: s, crop, rotate}} = label;
        Draw.clear(con);
        con.save();
        
        con.beginPath();
        angle ??= 0, rotate ??= 0, crop ??= 1;
        let { x: x0, y: y0 } = Draw.transform(con, s, 1, angle*1 + rotate*1, x, y), adj = CAN.hH * (Math.SQRT2 - 1);
        con.rect(x0 - adj, y0 - adj + CAN.hH * Math.SQRT2* (1 - crop), CAN.H * Math.SQRT2, CAN.H * Math.SQRT2 * crop);
        con.clip();

        ({x, y} = Draw.transform(con, s, 1, angle, x, y));

        type ??= 'Linear';
        let gradient = 
            type == 'Linear' ? con.createLinearGradient(0, y, 0, y + CAN.H) :
            type == 'Radial' ? con.createRadialGradient(x + CAN.hH, y + CAN.hH, 0, x + CAN.hH, y + CAN.hH, CAN.hH) :
            type == 'Conic' ? con.createConicGradient(-Math.PI/2, x + CAN.hH, y + CAN.hH) : null;

        let colors = [1,2,3].map(i => Draw.color.format(label.dataset[`color${i}`], label.dataset[`opacity${i}`])).filter(c => c);
        (colors.length === 1 || type == 'Conic') && colors.push(colors[0]);
        colors.forEach((c, i, ar) => gradient.addColorStop(i / (ar.length - 1), c));
        label.style.background = `${type}-gradient(${colors.join(',')}),white`;

        con.fillStyle = gradient;
        con.fillRect(x, y, CAN.H, CAN.H);
        con.restore();

        colors[0] && (label.Q('span').textContent = '');
    }
}); 
Draw.color.format = (color, opacity) => color ? `rgba(${color.replaceAll(/[^#]{2}/g, c => parseInt(c, 16) + ',').substring(1)}${opacity ?? 1})` : null;
