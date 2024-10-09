const canvas = Q('canvas');
const ctx = canvas.getContext('2d');
const frame = E('img', {
    src: './frame.png',
    onload: function() {
        canvas.width = this.naturalWidth;
        canvas.height = this.naturalHeight;
        frame.draw();
    }
});
frame.draw = () => ctx.drawImage(frame, 0, 0, canvas.width, frame.height/frame.width*canvas.width);

const Controls = {
    show (what) {
        Q('#type,#control,#control-image,#control-color', fieldset => fieldset.style.display = 'none');
        what === 0 ? (Q('#type').style.display = 'flex') : what && Q(`#control,#control-${what}`, fieldset => fieldset.style.display = 'grid');  
    },
    reset () {
        Q('input[type=color]', input => input.value = '#000000');
        Q('spin-knob', knob => knob.value = knob.initial);
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
        Layers.selected.dataset[ev.target.name] = ev.target.value;
        Draw();
    },
    image (ev) {
        Q('#layer').disabled = true;
        const reader = new FileReader();
        reader.readAsDataURL(ev.target.files[0]);
        reader.onload = () => {
            let img = E('img', {
                id: Math.random().toString(36).substring(2),
                src: reader.result,
                onload: function() {
                    Images[this.id] = this;
                    Layers.selected.dataset.image = this.id;
                    Q('form').dispatchEvent(new Event('change'));
                    Q('#layer').disabled = false;
                    Draw();
                }
            });
            Layers.selected.Q('span,img').replaceWith(img);
        }    
    },
    chooseType (ev) {
        ev.preventDefault();
        Layers.selected.dataset.type = ev.target.id;
        Layers.selected.Q('span').textContent = ev.target.textContent;
        Controls.show(ev.target.id);
    }
}
const Layers = {
    change (ev) {
        Layers.selected = Q('#layer label:has(:checked)');
        Layers.selected.dataset.type ? Controls.put() : Controls.show(0);    
    },
    add (ev) {
        ev.preventDefault();
        Layers.selected = E('label', [E('span'), E('input', {type: 'radio', name: 'layer', checked: true})])
        Q('#layer label:first-of-type').before(Layers.selected);
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
        ev.preventDefault();
        let current = Q('#layer label:has(:checked)');
        let sibling = current[`${ev.target.id == 'up' ? 'previous' : 'next'}ElementSibling`];
        sibling.tagName == 'LABEL' && sibling[ev.target.id == 'up' ? 'before' : 'after'](current);
        Draw();
    },
};
Q('#layer').onchange = Layers.change;
Q('#add').onclick = Layers.add;
Q('#delete').onclick = ev => ev.preventDefault();
Q('#delete').onpointerdown = Layers.delete;
Q('#up,#down', button => button.onclick = Layers.move);
Q('form [popovertarget]').onclick = ev => ev.preventDefault() ?? Q('aside').showPopover();
Q('form .type', button => button.onclick = Controls.chooseType);
Q('input[type=file]').onchange = ev => Controls.image(ev);
Q('input[type=color]', input => input.oninput = Controls.get);
Q('#control,#control-color spin-knob,input[name=gradient]', input => input.onchange = Controls.get);

const Images = {};
const Draw = () => {
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, frame.width, frame.height);

    [Q('#layer label')].flat().reverse().forEach((label, i) => {
        ctx.save();
        label.dataset.image && Draw.image(label, i);
        (label.dataset.color1 || label.dataset.color2) && Draw.color(label, i);
        ctx.restore();
    });
    frame.draw();
}
Object.assign(Draw, {
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
        let {gradient, angle, x, y, scale: s, pull: p, opacity} = label.dataset;
        let colors = [1,2,3].map(i => Draw.color.format(label.dataset[`color${i}`], label.dataset[`opacity${i}`])).filter(c => c);
        ({x, y} = Draw.transform(s, p, angle, x, y));

        ctx.globalAlpha = opacity ?? 1;
        gradient ??= 'Linear';
        let grad;
        if (gradient == 'Linear') 
            grad = ctx.createLinearGradient(x, 0, x + canvas.width, 0);
        else if (gradient == 'Radial')
            grad = ctx.createRadialGradient(x + canvas.width/2, y + canvas.width/2, 0, x + canvas.width/2, y + canvas.width/2, canvas.width/2);
        else if (gradient == 'Conic')
            grad = ctx.createConicGradient(-Math.PI/2, x + canvas.width/2, y + canvas.width/2);
        
        grad.addColorStop(0, colors[0]);
        if (colors.length === 1) {
            grad.addColorStop(1, colors[0]);
            label.style.background = colors[0];
        } else {
            gradient == 'Conic' && colors.push(colors[0]);
            colors.slice(1).forEach((c, i, ar) => grad.addColorStop((i + 1)/ar.length, c));
            label.style.background = `${gradient}-gradient(${colors.join(',')})`;
        }
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, canvas.width, canvas.width);

        label.Q('span').textContent = '';
    }
}); 
Draw.color.format = (color, opacity) => color ? `rgba(${color.replaceAll(/[^#]{2}/g, c => parseInt(c, 16) + ',').substring(1)}${opacity ?? 1})` : null;

var PageSizes = {
    A4: [595.28, 841.89],
};
Q('#output').onclick = async () => {
    const pdfDoc = await PDFLib.PDFDocument.create();
    const page = pdfDoc.addPage([PageSizes.A4[1], PageSizes.A4[0]]);
    const { width, height } = page.getSize();
    page.moveTo(20, 20);
    
    const pngImage = await pdfDoc.embedPng(canvas.toDataURL("image/png", 1.0));
    const pngDims = pngImage.scale(1);
    var posX = 0;
    var posY = 0;
    var writePos = (1 * 1);
    var r = (writePos - (writePos % 2)) / 2;
    if (writePos % 2 == 0) {
        posX = (width - canvas.width) / 2 - (canvas.width / 2) - 10;
    } else {
        posX = (width - canvas.width) / 2 + (canvas.width / 2) + 10;
    }
    posY = height - 20 - (250) * (r + 1) + 1;
    page.drawImage(pngImage, {
        x: posX,
        y: posY,
        width: pngDims.width,
        height: pngDims.height,
    });
    window.open(URL.createObjectURL(new Blob([await pdfDoc.save()], { type: 'application/pdf' })));
}
