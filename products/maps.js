Mapping.brochure = no => `detail_${no.replace('-', '').toLowerCase()}`;
Mapping.maps = {
    ...Mapping.maps,
    image: new Mapping(
        'BXG-03', 'https://takaratomymall.jp/img/goods/3/4904810913344_79d06c0bdc8743569fad277a2be9a560.jpg',
        no => no.replace('-', '') + '_list'
    ),
    brochure: new Mapping(
        'BXG-03', 'https://takaratomymall.jp/img/goods/BEYBLADE/img_4904810913344.jpg',
        'BX-21', no => ['p','y','o'].map(c => `${Mapping.brochure(no)}_${c}`),
        'BX-20', no => ['B','G','P'].map(c => `${Mapping.brochure(no)}${c}`),
        'BX-17', no => ['A','B'].map(c => `${Mapping.brochure(no)}${c}`),
        'BX-15', no => `detail_${no.replace('-', '')}`,
        'BX-08', no => ['r','g','y'].map(c => `${Mapping.brochure(no)}_${c}`),
        Mapping.brochure
    ),
    rare: new Mapping(
    ),
    rate: new Mapping(
        'BXG-03', 'App 抽中後購買',
        ['BX-16'], '各款封入比例均等',
        ['BX-14','BX-24'], '封入比例：01、02 各 3；04、05 各 4；03、06 各 5',
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