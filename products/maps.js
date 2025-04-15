Mapping.brochure = (no, upper) => `detail_${no.replace('-', '')[`to${upper ? 'Upper' : 'Lower'}Case`]()}`;
Mapping.maps = {
    ...Mapping.maps,
    rare: new Mapping(),
    note: new Mapping(
        /^BXG-(14|35)$/, '日本以外未有發售',
        /^BXG-(03|05|08|17|23|32)$/, 'App 内抽中後購買',
        'BXG-31', '各部件自選一色',
        ['BXG-07','BX-36','UX-05','BX-16','BX-27', 'BX-39'], '各款封入比例均等',
        ['BX-35','BX-24','BX-14','UX-12'], '封入比例：01、02 各 3；04、05 各 4；03、06 各 5',
        ['BX-31'], '封入比例：01、02 各 3；03、04 各 4；05、06 各 5',
    ),
    images: new Mapping(
        'CX-04', {detail: '${no}_(d|p)', detailUpper: true},
        'UX-07', {detail: '${no}_(r|g|b)', more: '${no}_(r|g|b)'},
        'BX-21', {detail: '${no}_(p|y|o)', more: '${no}_(p|y|o)'},
        'BX-20', {detail: '${no}(B|G|P)', more: '${no}_(b|g|p)'},
        ['BX-17','UX-04'], {detail: '${no}(A|B)'},
        'BXG-25', {switch: 'BXA-02', detail: 'bxa_02_d(b2|d|s)'},
        'BXG-17', {switch: 'BXG_bit01'},
        'BXG-14', {switch: 'BXG-09'},
        'BXG-12', {switch: 'BXG-00'},
        'BXG-09', {switch: 'BXG-14'},
        'BXG-07', {underscore: true, detail: '${no}_(1|2)'},
        /^BXG-(03|05|06|13|35)$/, {detailUpper: true},
        /^UX-14/, {detailUpper: true},
        /^CX/, {detailUpper: true},
        'BX-08', {detail: '${no}_(r|g|y)', more: '${no}_(r|g|y)'},
    )
}
