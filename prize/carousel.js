class Carousel extends HTMLElement {
    constructor(imgs, labels) {
        super();
        this.indices = [...Array(imgs.length).keys()];
        this.attachShadow({mode: 'open'}).innerHTML = `
        <link rel=stylesheet href=/include/common.css>
        <style>
        :host {
            display:block;
        }
        ol li {
            position:absolute;
        }
        ol img {
            opacity:.5;transform:scale(0.8);
            pointer-events:none;
        }
        img:not([src]) {
            background:var(--theme);opacity:.2;
            height:50vw;
        }
        li.checked img {
            opacity:1;transform:scale(1);
            transition:transform 1s 0.75s,opacity 1s;
            pointer-events:auto;
        }
        ol,ol li,ol img {
            width:100%;
            transition:transform 1s,opacity 1s;will-change:transform;
        }
        @media (max-width:799px) {
            ol {
                padding-bottom:68%;
            }
            ol li {
                left:calc(var(--index)*100%);
                padding:0 0.1em;
                transform:translateX(calc(var(--checked)*-100%));
            }
        }
        @media (min-width:800px) {
            :host {
                perspective:1500px;
                margin:0 auto 10em auto;
                --screen:100vw;
                --width:calc(740/800*var(--screen));
                --extend:calc((140*var(--amount) - 160)*var(--screen)/1000);
                width:var(--width);height:calc(0.625*var(--width));
                perspective-origin:50% calc(500px + var(--screen)/2 - 30px*var(--amount));
            }
            ol {
                --spin:calc(360deg/var(--amount)*(var(--checked) - 1));
                transform:translateZ(calc(-1*var(--extend))) rotateY(calc(-1*var(--spin)));
                transform-style:preserve-3d;
            }
            ol li {
                --position:calc(360deg/var(--amount)*(var(--index) - 1));
                transform:rotateY(var(--position)) translateZ(var(--extend));
            }
        }
        @media (min-width:1200px) {
            :host {--screen:1200px;} 
        }
        menu {
            margin:1em auto 2em auto;
            display:flex;justify-content:space-evenly;
        }
        label {
            padding-bottom:.1em;
            border-bottom:.15em solid var(--theme);
        }
        li:not(.checked) label {
            filter:saturate(0);
        }
        label img {
            height:2.35rem;
        }
        </style>
        <menu>${this.controls(labels)}</menu>
        <ol>${this.carousel(imgs)}</ol>`;
        this.style.setProperty('--amount', imgs.length);
        this.shadowRoot.Q('input[name=pages]', (input, i) => input.onchange = () => this.switch(i + 1));
        setTimeout(() => this.shadowRoot.Q('li:first-child input').click());
    }
    controls = labels => labels.reduce((html, label) => html += `<li><label><input type=radio name=pages><img src=${label} alt=Prizes></label>`, '');
    carousel = imgs => imgs.reduce((html, img, i) => html += `<li style='--index:${i + 1}'><a><img alt=${img}></a>`, '');
    switch = i => {
        this.shadowRoot.Q('ol').style.setProperty('--checked', i);
        this.shadowRoot.Q('li.checked', li => li.classList = '');
        this.shadowRoot.Q(`li:nth-child(${i})`, li => li.classList = 'checked');
        let checked = this.shadowRoot.Q(`ol .checked img`);
        checked.parentNode.href = checked.src = checked.alt;
    }
}
customElements.define('spin-carousel', Carousel);