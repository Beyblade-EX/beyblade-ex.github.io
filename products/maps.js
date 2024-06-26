Mapping.brochure = (no, upper) => `detail_${no.replace('-', '')[`to${upper ? 'Upper' : 'Lower'}Case`]()}`;
Mapping.maps = {
    ...Mapping.maps,
    rare: new Mapping(
    ),
    note: new Mapping(
        ['BXG-05','BXG-03'], 'App 内 3% 機率抽中後購買',
        ['UX-05','BX-16','BX-27'], '各款封入比例均等',
        ['BX-24','BX-14'], '封入比例：01、02 各 3；04、05 各 4；03、06 各 5',
        ['BX-31'], '封入比例：01、02 各 3；03、04 各 4；05、06 各 5',
    ),
    oversize: {
        eng: new Mapping(
        ),
        chi: new Mapping(
        ),
        jap: new Mapping(
        )
    },
    images: new Mapping(
        'BX-21', {detail: '${no}_(p|y|o)', more: '${no}_(p|y|o)'},
        'BX-20', {detail: '${no}(B|G|P)', more: '${no}_(b|g|p)'},
        ['BX-17','UX-04'], {detail: '${no}(A|B)'},
        /^BXG-0(3|5|6)$/, {detailUpper: true},
        'BX-08', {detail: '${no}_(r|g|y)', more: '${no}_(r|g|y)'},
    )
}
