const MAIN = {con: Q('canvas').getContext('2d', { alpha: false })};
const loadIMG = src => new Promise(res => E('img', {src, onload: function() {res(this);}}));
const App = () => {
    App.loading(true);
    Controls.show(null);
    Q('form button', button => button.type = 'button');
    App.events();
    loadIMG('./frame.png').then(img => {
        MAIN.W = MAIN.con.canvas.width = img.naturalWidth, MAIN.H = MAIN.con.canvas.height = img.naturalHeight;
        MAIN.hW = MAIN.W/2, MAIN.hH = MAIN.H/2;
        Layers.frame = img;
        App.load((location.hash ||= '#1').substring(1));
    });
    PDFLib.A4 = PDFLib.PageSizes.A4.sort((a, b) => a - b);
}
Object.assign(App, {
    get designs () {return Q('nav menu a[href^="#"]').reverse()},
    reset () {
        Controls.reset();
        Q('#layers').replaceChildren(Layers.label());
        Layers.labels[0].click();
        Layers.soloing = null;
        Draw();
        App.loading(false);
    },
    loading: loading => (Layers.soloing = null) || Q('summary').classList[loading ? 'add' : 'remove']('loading'),
    save: () => Layers.modified && DB.put('user', {[`sheet-${location.hash.substring(1)}`]: Layers.get()}),
    load: no => DB.get('user', `sheet-${no}`).then(layers => layers ? Layers.put(layers) : App.reset()),
    stage (design) {
        if (design === true)
            return App.designs.reduce((prom, a) => prom.then(() => a.canvas ? 
                Promise.resolve(a.href == location.href && App.stage(a)) :
                App.load(a.getAttribute('href').substring(1)).then(() => App.stage(a))
            ), Promise.resolve());
        (design.canvas ??= MAIN.con.canvas.cloneNode(true)).getContext('2d').drawImage(MAIN.con.canvas, 0, 0);
    },
    switch (ev) {
        Layers.solo(false);
        typeof ev == 'object' && App.stage(Q(`a[href='${new URL(ev.oldURL).hash}']`));
        /^#[1-6]$/.test(location.hash) ? App.load(location.hash.substring(1)) : location.href = '#1'
    },
    export () {
        E('a', {
            href: `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(Layers.get()))}`,
            download: 'sheet.json'
        }).click();
    },
    import (ev) {
        App.loading(true);
        let reader = new FileReader();
        reader.readAsText(ev.target.files[0]);
        reader.onload = () => Layers.put(JSON.parse(reader.result));
    },
    sample () {
        App.loading(true);
        fetch('./sample.json').then(resp => resp.json()).then(Layers.put);    
    },
    download () {
        Layers.solo(false);
        App.loading(true);
        let pdf, pages = [];
        let amount = [...Q('#download+input').value];    
        App.stage(true).then(() => PDFLib.PDFDocument.create()).then(doc => {
            pdf = doc;
            let canvases = App.designs.map(a => a.canvas);
            amount = amount.map((n, i) => canvases[i] ? parseInt(n) : 0);
            for (let i = 0; i < Math.ceil(amount.reduce((sum, n) => sum += n, 0)/12); i++)
                pages[i] = doc.addPage(PDFLib.A4);
            return Promise.all(canvases.map(can => can ? doc.embedPng(can.toDataURL("image/png", 1.0)) : null));
        }).then(images => {
            images.flatMap((im, i) => im ? Array(amount[i]).fill(im) : []).forEach((image, i) => {
                let scaled = image.scale(.292);
                pages[Math.floor(i/12)].drawImage(image, {
                    x: 20 + i % 6 * (12.5 + scaled.width),
                    y: 84.5 + (1 - Math.floor(i/6) % 2) * (20 + scaled.height),
                    width: scaled.width, height: scaled.height,
                });
            });
            return pdf.save();
        }).then(doc => {
            open(URL.createObjectURL(new Blob([doc], { type: 'application/pdf' })))
            App.loading(false);
            App.switch(location.hash);
        }).catch(er => console.error(er));
    },
    events () {
        Object.assign(Q('form'), {
            oncontextmenu: () => false,
            onpointerup: App.save
        });
        Object.assign(Q('#layer'), {
            onchange: Layers.change,
            ondblclick: Layers.solo,
            ontouchend: ev => {
                let current = new Date().getTime();
                let interval = current - App.lastTap;
                interval < 500 && interval > 0 && (ev.preventDefault(), ev.target.dispatchEvent(new Event('dblclick', {bubbles: true})));
                App.lastTap = current;
            },
            onclick: ev => ev.target.id == 'create' ? Layers.create(ev) : ['up', 'down'].includes(ev.target.id) ? Layers.move(ev) : null,
            onpointerdown: ev => ev.target.id == 'delete' && Layers.delete(ev)
        });
        Object.assign(Q('#control-image'), {
            onchange: Controls.image,
            onclick: ev => {
                if (!ev.target.popoverTargetElement) return;
                ev.preventDefault();
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

        onkeydown = ev => ev.key == 'Control' ? Q('#fine').click() : null;
        onhashchange = App.switch;
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
    get modified () {return Layers.labels.length > 1 || Layers.labels[0]?.dataset.type},
    label: (dataset, img) => {
        let label = E('label', {dataset}, [img ?? E('span'), E('input', {type: 'radio', name: 'layer'})]);
        label.can = new OffscreenCanvas(MAIN.W, MAIN.H);
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
    solo (ev) {
        if (ev !== false && ev.target.tagName != 'LABEL') return;
        Layers.soloing?.classList.remove('solo');
        ev !== false && Layers.soloing != ev.target ? 
            (Layers.soloing = ev.target).classList.add('solo') : 
            Layers.soloing = null;
        Draw();
    },
    async put (layers) {
        const labels = await Promise.all(layers.map(ds => ds.image ?
            loadIMG(ds.image).then(img => Layers.label((({ image, ...others }) => others)(ds), img)) :
            Layers.label(ds)
        ));
        Q('#layers').replaceChildren(...labels);
        labels[0]?.click();
        Draw(true);
        App.loading(false);
    },
    get: () => [...Layers.labels]
        .map(label => ({...label.dataset, ...label.img ? {image: label.img.src} : {}}))
        .filter(obj => Object.keys(obj).length)
};
const Draw = all => {
    clearTimeout(App.timer);
    Draw.clear();
    [...Layers.labels].reverse().forEach(label => {
        if (all || Layers.selected === label) {
            label.img && Draw.image(label);
            label.dataset.type == 'color' && Draw.color(label);
        }
        (!Layers.soloing || Layers.soloing == label) && MAIN.con.drawImage(label.can, 0, 0);
    });
    Draw.frame();
    App.timer = setTimeout(App.save, 1000);
}
Object.assign(Draw, {
    clear: context => context ? context.clearRect(0, 0, MAIN.W, MAIN.H) : (MAIN.con.fillStyle = 'silver') && MAIN.con.fillRect(0, 0, MAIN.W, MAIN.H),
    frame: () => MAIN.con.drawImage(Layers.frame, 0, 0, MAIN.W, MAIN.H),
    transform (con, {sk, sc, ro, st, x, y}, img) { //translate -> skew -> scale -> rotate -> stretch
        sk ??= 0, sc ??= 1, ro ??= 0, st ??= 1, x ??= 0, y ??= 0;
        let drawing = img ? {W: img.naturalWidth, H: img.naturalHeight} : {W: MAIN.H, H: MAIN.H};
        if (img) {
            img.fit ??= Draw.transform.fit(drawing, {xW: drawing.W - MAIN.W, xH: drawing.H - MAIN.H});
            drawing.W *= img.fit, drawing.H *= img.fit;
        }
        drawing.hW = drawing.W/2, drawing.hH = drawing.H/2;

        let cos = Math.cos(ro*Math.PI), sin = Math.sin(ro*Math.PI), tan = Math.tan(sk*Math.PI);
        x = -x*(MAIN.hW+drawing.hW)-MAIN.hW, y = y*(MAIN.hH+drawing.hH)-MAIN.hH;
        con.setTransform(sc*cos, sc*st*sin, sc*(cos*tan-sin), sc*st*(sin*tan+cos), x*sc*cos+y*sc*(cos*tan-sin)-x, x*sc*st*sin+y*sc*st*(sin*tan+cos)-y);
        return {x: Math.round(-x-drawing.hW), y: Math.round(-y-drawing.hH), W: drawing.W, H: drawing.H};
    },
    image (label) {
        let {img, con, dataset: {sc, ro, st, x, y, opacity}} = label, W, H;
        Draw.clear(con);
        con.save();
        ({x, y, W, H} = Draw.transform(con, {sc, ro, st, x, y}, img));
        con.globalAlpha = opacity ?? 1;
		con.drawImage(img, x, y, W, H);
        con.restore();
    },
    color (label) {
        let {con, dataset: {gradient: type, sk, sc, ro, x, y, angle}} = label;
        Draw.clear(con);
        con.save();
        ({x, y} = Draw.transform(con, {sk, sc, ro, x, y}));

        angle = (angle ??= 0) * Math.PI - Math.PI / 2;
        let from = Draw.color.rotated(angle), to = Draw.color.rotated(angle + Math.PI);
        type ??= 'Linear';
        let gradient = 
            type == 'Linear' ? con.createLinearGradient(from.x + MAIN.hW - MAIN.hH, from.y, to.x + MAIN.hW - MAIN.hH, to.y) :
            type == 'Radial' ? con.createRadialGradient(x + MAIN.hH, y + MAIN.hH, 0, x + MAIN.hH, y + MAIN.hH, MAIN.hH) :
            type == 'Conic' ? con.createConicGradient(angle, x + MAIN.hH, y + MAIN.hH) : null;

        let colors = [1,2,3].map(i => Draw.color.format(label.dataset[`color${i}`], label.dataset[`opacity${i}`])).filter(c => c);
        (colors.length === 1 || type == 'Conic') && colors.push(colors[0]);
        colors.forEach((c, i, ar) => gradient.addColorStop(i / (ar.length - 1), c));
        label.style.background = `${type}-gradient(${colors.join(',')}),white`;

        con.fillStyle = gradient;
        con.fillRect(x, y, MAIN.H, MAIN.H);
        con.restore();

        colors[0] && (label.Q('span').textContent = '');
    }
});
Draw.transform.fit = (drawing, { xH, xW }) => xW > 0 && xH > 0 ? xW < xH ? MAIN.W / drawing.W : MAIN.H / drawing.H : 1;
Draw.color.format = (color, opacity) => color ? `rgba(${color.replaceAll(/[^#]{2}/g, c => parseInt(c, 16) + ',').substring(1)}${opacity ?? 1})` : null;
Draw.color.rotated = angle => {
    let ratio = {cos: Math.cos(angle), sin: Math.sin(angle)};
    let coor = ['cos', 'sin'].map(r => MAIN.H*Math.max(0, Math.min(.5*Math.SQRT2*ratio[r] + .5, 1)));
    return {x: coor[0],y: coor[1]};
}