Mapping.brochure = (no, upper) => `detail_${no.replace('-', '')[`to${upper ? 'Upper' : 'Lower'}Case`]()}`;
Mapping.maps = {
    ...Mapping.maps,
    image: new Mapping(
        no => no.replace('-', '') + '@1'
    ),
    brochure: new Mapping(
        'BXG-04', no => Mapping.brochure(no),
        /^BXG-(?!01)/, no => Mapping.brochure(no, true),
        'BX-21', no => ['p','y','o'].map(c => `${Mapping.brochure(no)}_${c}`),
        'BX-20', no => ['B','G','P'].map(c => `${Mapping.brochure(no)}${c}`),
        ['BX-17','UX-04'], no => ['A','B'].map(c => `${Mapping.brochure(no)}${c}`),
        'BX-08', no => ['r','g','y'].map(c => `${Mapping.brochure(no)}_${c}`),
        Mapping.brochure
    ),
    rare: new Mapping(
    ),
    note: new Mapping(
        ['BXG-05','BXG-03'], 'App 内抽中後購買',
        ['BX-16','BX-27'], '各款封入比例均等',
        ['BX-24','BX-14'], '封入比例：01、02 各 3；04、05 各 4；03、06 各 5',
    ),
    oversize: {
        eng: new Mapping(
        ),
        chi: new Mapping(
        ),
        jap: new Mapping(
        )
    },
}