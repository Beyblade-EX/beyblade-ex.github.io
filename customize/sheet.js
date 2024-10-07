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

Q('form [popovertarget]').onclick = ev => ev.preventDefault() ?? Q('aside').showPopover();
Q('form').onchange = ev => {
    Q('label:has(input:checked)').dataset[ev.target.name] = ev.target.value;
    ctx.fillRect(0, 0, frame.width, frame.height);

    [Q('#layer label')].flat().forEach(label => {
        ctx.save();
        let {image, rotate, x, y, scale, opacity} = label.dataset;
        image = Q(`img[src='${image}']`);
        x ??= 0, y ??= 0, scale ??= 1, rotate ??= 0;

        ctx.globalAlpha = opacity;
        let trX = x*1 + image.naturalWidth * scale / 2, trY = y*1 + image.naturalHeight * scale / 2;
        ctx.translate(trX, trY);
        ctx.rotate(rotate / 180 * Math.PI);
        ctx.translate(-trX, -trY);

		ctx.drawImage(image, x, y, image.naturalWidth * scale, image.naturalHeight * scale);
        ctx.restore();
    });
    frame.draw();
}
Q('#layer').onclick = ev => {
    if (ev.target.tagName != 'BUTTON') return;
    ev.preventDefault();
    if (ev.target.id == 'add') 
        return Q('#layer label:last-of-type').after(E('label', [Math.random(), E('input', {type: 'radio', name: 'layer', checked: true})]));
    if (ev.target.id == 'up') {
        let now = Q('#layer label:has(:checked)')
        let prev = now.previousElementSibling;
        return prev.tagName == 'LABEL' && prev.before(now);
    }
    if (ev.target.id == 'down') {
        let now = Q('#layer label:has(:checked)')
        let prev = now.nextElementSibling;
        prev.tagName == 'LABEL' && prev.after(now);
    }
}
Q('[popover]').onclick = ev => {
    if (ev.target.tagName != 'IMG') return;
    Q('label:has(input:checked)').dataset.image = ev.target.src;
    ctx.drawImage(ev.target, 0, 0, ev.target.naturalWidth, ev.target.naturalHeight);
    frame.draw();
}
