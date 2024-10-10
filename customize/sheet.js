const canvas = Q('canvas');
const ctx = canvas.getContext('2d');

const Controls = {
    show (what) {
        Q('#type,#control,#control-image,#control-color', fieldset => fieldset.style.display = 'none');
        what === 0 ? (Q('#type').style.display = 'flex') : what && Q(`#control,#control-${what}`, fieldset => fieldset.style.display = 'grid');  
    },
    reset () {
        Q('input[type=color]', input => input.value = '#000000');
        Q('spin-knob', knob => knob.init());
    },
    put () {
        let {type, ...controls} = Layers.selected.dataset;
        Controls.show(type);
        Object.entries(controls).forEach(([n, v]) => {
            let control = Q(`input[name=${n}]`);
            control && ((control.type == 'range' ? control.parentElement : control).value = v);
        });
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
        reader.onload = () => Images.load(reader.result)
            .then(img => {
                Layers.selected.dataset.image = img.id;
                Layers.selected.Q('span,img').replaceWith(img);
                Q('form').dispatchEvent(new Event('change'));
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
const Layers = {
    frame: E('img', {
        src: './frame.png',
        onload: function() {
            canvas.width = this.naturalWidth;
            canvas.height = this.naturalHeight;
            Draw.frame();
        }
    }),
    change (ev) {
        Q('#delete').disabled = Q('#layer label:only-of-type');
        Layers.selected = Q('#layer label:has(:checked)');
        Layers.selected.dataset.type ? Controls.put() : Controls.show(0);
    },
    add (ev) {
        Layers.selected = E('label', [E('span'), E('input', {type: 'radio', name: 'layer', checked: true})]);
        Q('#layer label:first-of-type').before(Layers.selected);
        Q('#delete').disabled = false;
        Controls.reset();
        Controls.show(0);
    },
    delete (ev) {
        Q('form .message').hidden = false;
        setTimeout(() => Q('form .message').hidden = true, 2000);
        let timer = setTimeout(() => {
            Layers.selected.remove();
            Q('#layer label:first-of-type').click();
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
        let layers = [...document.querySelectorAll('#layer label')].map(label => {
            let data = {...label.dataset};
            data.image &&= Images[data.image].src;
            return data;
        }).filter(obj => Object.keys(obj).length);
        E('a', {
            href: `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(layers))}`,
            download: 'sheet.json'
        }).click();
    },
    import (ev) {
        const reader = new FileReader();
        reader.readAsText(ev.target.files[0]);
        reader.onload = () => {
            Q('#layer label', label => label.remove());
            let label = (dataset, img) => E('label', {dataset}, [img ?? E('span'), E('input', {type: 'radio', name: 'layer'})]);

            Promise.all(JSON.parse(reader.result).map(dataset => dataset.image ? 
                Images.load(dataset.image).then(img => label({...dataset, image: img.id}, img)) : 
                label(dataset)
            )).then(labels => {
                Q('#delete').after(...labels);
                Q('#layer label:first-of-type').click();
            });
        }
    }
};
const Images = {
    load: src => new Promise(res => E('img', {
        id: Math.random().toString(36).substring(2), src, 
        onload: function() {res(Images[this.id] = this);}
    }))
};
const Draw = () => {
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, Layers.frame.width, Layers.frame.height);

    [Q('#layer label')].flat().reverse().forEach((label, i) => {
        ctx.save();
        label.dataset.image && Draw.image(label, i);
        (label.dataset.color1 || label.dataset.color2) && Draw.color(label, i);
        ctx.restore();
    });
    Draw.frame();
}
Object.assign(Draw, {
    frame: () => ctx.drawImage(Layers.frame, 0, 0, canvas.width, Layers.frame.height / Layers.frame.width * canvas.width),
    transform (s, p, angle, x, y, image) {
        s ??= 1, p ??= 1, angle ??= 0, x ??= 0, y ??= 0;
        let drawing = {width: image?.naturalWidth ?? canvas.width, height: image?.naturalHeight ?? canvas.width};

        let cos = Math.cos(angle*Math.PI), sin = Math.sin(angle*Math.PI);
        x = -x * (canvas.width / 2 + drawing.width / 2) + canvas.width / -2;
        y = y * (canvas.height / 2 + drawing.height / 2) + canvas.height / -2;
        ctx.setTransform(s*cos, s*p*sin, -s*sin, s*p*cos, x*s*cos-y*s*sin-x, x*s*p*sin+y*s*p*cos-y);
        return {x: -x-drawing.width/2, y: -y-drawing.height/2};
    },
    image (label) {
        let {image, angle, x, y, scale: s, pull: p, opacity} = label.dataset;
        image = Images[image];
        ({x, y} = Draw.transform(s, p, angle, x, y, image));
        ctx.globalAlpha = opacity ?? 1;
		ctx.drawImage(image, x, y, image.naturalWidth, image.naturalHeight);
    },
    color (label) {
        let {gradient: type, angle, x, y, scale: s, pull: p, opacity} = label.dataset;
        let colors = [1,2,3].map(i => Draw.color.format(label.dataset[`color${i}`], label.dataset[`opacity${i}`])).filter(c => c);
        ({x, y} = Draw.transform(s, p, angle, x, y));

        type ??= 'Linear';
        let gradient;
        if (type == 'Linear') 
            gradient = ctx.createLinearGradient(x, 0, x + canvas.width, 0);
        else if (type == 'Radial')
            gradient = ctx.createRadialGradient(x + canvas.width/2, y + canvas.width/2, 0, x + canvas.width/2, y + canvas.width/2, canvas.width/2);
        else if (type == 'Conic')
            gradient = ctx.createConicGradient(-Math.PI/2, x + canvas.width/2, y + canvas.width/2);

        gradient.addColorStop(0, colors[0]);
        (colors.length === 1 || type == 'Conic') && colors.push(colors[0]);
        colors.slice(1).forEach((c, i, ar) => gradient.addColorStop((i + 1) / ar.length, c));
        label.style.background = `${type}-gradient(${colors.join(',')})`;

        ctx.globalAlpha = opacity ?? 1;
        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, canvas.width, canvas.width);

        label.Q('span').textContent = '';
    }
}); 
Draw.color.format = (color, opacity) => color ? `rgba(${color.replaceAll(/[^#]{2}/g, c => parseInt(c, 16) + ',').substring(1)}${opacity ?? 1})` : null;

Q('form button', button => button.type = 'button');
Object.assign(Q('#layer'), {
    onchange: Layers.change,
    onclick: ev => ev.target.id == 'add' ? Layers.add(ev) : ['up', 'down'].includes(ev.target.id) ? Layers.move(ev) : null,
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
Q('#download').onclick = () => {
    let document, page;
    PDFLib.PDFDocument.create()
    .then(doc => {
        document = doc;
        page = doc.addPage(PDFLib.PageSizes.A4.sort((a, b) => b - a));
        return doc.embedPng(canvas.toDataURL("image/png", 1.0));
    })
    .then(image => {
        let scaled = image.scale(.2427);
        for (let i = 0; i <= 11; i++)
            page.drawImage(image, {
                x: 84.5 + i % 2 * (20 + scaled.width),
                y: 488 - Math.floor(i / 2) * (12.5 + scaled.height),
                width: scaled.width,
                height: scaled.height,
            });
        return document.save();
    })
    .then(doc => window.open(URL.createObjectURL(new Blob([doc], { type: 'application/pdf' }))))
    .catch(er => console.error(er));
}
