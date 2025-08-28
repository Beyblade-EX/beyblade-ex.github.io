Mapping.maps = {
    ...Mapping.maps,
    rare: new Mapping(),
    note: new Mapping(
        /^BXG-(14|31|35)$/, '日本以外未有發售',
        /^BXG-(03|05|08|17|23|42|43)$/, 'App内抽中後購買',
        ['CX-06','BX-39','BX-27','BXG-07','BX-36','UX-05','BX-16'], '各款封入比例均等',
        ['BX-35','BX-24','BX-14','UX-12'], '封入比例：01、02各3；04、05各4；03、06各5',
        ['BX-31'], '封入比例：01、02各3；03、04各4；05、06各5',
        ['CX-05','CX-08'], '封入比例：01×3；03×5；其餘各4',
    ),
    images: new Mapping(
        'BX-46', {detail: '${no}(_01|_02)'},
        'UX-15', {detail: '${no}(|_2|_3)'},
        'CX-04', {detail: '${no}_(d|p)'},
        'UX-07', {detail: '${no}_(r|g|b)', more: '${no}_(r|g|b)'},
        'BX-21', {detail: '${no}_(p|y|o)', more: '${no}_(p|y|o)'},
        'BX-20', {detail: '${no}(B|G|P)', more: '${no}_(b|g|p)'},
        ['BX-17','UX-04'], {detail: '${no}(A|B)'},
        'BXG-25', {alias: 'BXA-02', detail: 'bxa_02_d(b2|d|s)'},
        'BXG-17', {alias: 'BXG_bit01'},
        'BXG-14', {alias: 'BXG-09'},
        'BXG-12', {alias: 'BXG-00'},
        'BXG-09', {alias: 'BXG-14'},
        'BXG-07', {underscore: true, detail: '${no}_(1|2)'},
        'BX-08', {detail: '${no}_(r|g|y)', more: '${no}_(r|g|y)'},
    )
}
