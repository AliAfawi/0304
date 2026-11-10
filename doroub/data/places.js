/* دُروب V8 — طبقة المناطق والتصنيفات.
   تُبنى فوق data/trails.js و data/heritage.js دون تغيير بياناتهما الأصلية. */
(function (w) {
  'use strict';

  /* ثلاث مناطق رئيسية، لكل واحدة صورة مرساة من مكان موثّق داخل الدليل. */
  w.DOROUB_REGIONS = [
    {
      id: 'S', nameByLang: { ar: 'الجنوب والنقب', he: 'הדרום והנגב', en: 'South and Negev' }, name: 'الجنوب والنقب',
      tagline: 'صحراء وأخاديد وألوان لا تتكرر',
      blurb: 'من جبال إيلات الحمراء إلى مكتش رامون والمدن النبطية، منطقة الصحراء والمغامرات الطويلة.',
      anchor: 'redcanyon', accent: '#d08a3f'
    },
    {
      id: 'C', nameByLang: { ar: 'المركز والقدس', he: 'המרכז וירושלים', en: 'Centre and Jerusalem' }, name: 'المركز والقدس',
      tagline: 'طبيعة وآثار على بُعد نصف ساعة',
      blurb: 'ينابيع سطاف وأودية القدس، وساحل الوسط، وآثار الرملة واللطرون — قريبة وسهلة الوصول.',
      anchor: 'sataf-combo', accent: '#4f9d62'
    },
    {
      id: 'N', nameByLang: { ar: 'الشمال والجليل', he: 'הצפון והגליל', en: 'North and Galilee' }, name: 'الشمال والجليل',
      tagline: 'مياه وخضرة وحكايات حضارات',
      blurb: 'بانياس وتل دان وأربيل وعكا وصفورية — ماء دائم، غابات، ومواقع أثرية من كل العصور.',
      anchor: 'banias-fall', accent: '#2f8f93'
    }
  ];

  /* المناطق الفرعية: الاسم العربي، وصف قصير، ومكان مرساة للصورة. */
  w.DOROUB_ZONES = [
    { id: 'eilat',      r: 'S', nameByLang: { ar: 'جبال إيلات', he: 'הרי אילת', en: 'Eilat Mountains' }, name: 'جبال إيلات',        blurb: 'جبال حمراء وأخاديد ضيقة ومسارات شاقة قرب خليج العقبة.',       anchor: 'redcanyon' },
    { id: 'timna',      r: 'S', nameByLang: { ar: 'وادي تمناع', he: 'עמק תמנע', en: 'Timna Valley' }, name: 'وادي تمناع',        blurb: 'أعمدة سليمان والأقواس الصخرية وتاريخ تعدين النحاس.',          anchor: 't-pillars' },
    { id: 'negev',      r: 'S', nameByLang: { ar: 'النقب ومكتش رامون', he: 'הנגב ומכתש רמון', en: 'Negev and Makhtesh Ramon' }, name: 'النقب ومكتش رامون', blurb: 'فوهة رامون وعين عفدات والمدن النبطية عبدة وشبطا وممشيت.',     anchor: 'ein-avdat' },
    { id: 'dead',       r: 'S', nameByLang: { ar: 'البحر الميت والعربة', he: 'ים המלח והערבה', en: 'Dead Sea and Arava' }, name: 'البحر الميت والعربة', blurb: 'عين جدي ومسادا وأودية منحدرة نحو أخفض بقعة على الأرض.',    anchor: 'masada-snake' },
    { id: 'jer',        r: 'C', nameByLang: { ar: 'جبال القدس', he: 'הרי ירושלים', en: 'Jerusalem Hills' }, name: 'جبال القدس',        blurb: 'سطاف ووادي القلط وتراسات زراعية وينابيع قديمة.',             anchor: 'sataf-combo' },
    { id: 'shfela',     r: 'C', nameByLang: { ar: 'السهل والرملة', he: 'השפלה ורמלה', en: 'Shephelah and Ramla' }, name: 'السهل والرملة',     blurb: 'آثار الرملة الإسلامية، كنيسة اللطرون، وبيت جبرين.',          anchor: 'hist-white-tower' },
    { id: 'coast',      r: 'C', nameByLang: { ar: 'ساحل الوسط', he: 'מישור החוף', en: 'Central Coast' }, name: 'ساحل الوسط',        blurb: 'قيسارية وأبولونيا وأنهار الساحل ومسارات عائلية مستوية.',      anchor: 'hist-caesarea' },
    { id: 'south_coast', r: 'C', nameByLang: { ar: 'الساحل الجنوبي', he: 'החוף הדרומי', en: 'Southern Coast' }, name: 'الساحل الجنوبي',   blurb: 'عسقلان وآثارها الكنعانية والرومانية على البحر.',             anchor: 'hist-ashkelon' },
    { id: 'carmel',     r: 'N', nameByLang: { ar: 'ساحل الكرمل', he: 'חוף הכרמל', en: 'Carmel Coast' }, name: 'ساحل الكرمل',       blurb: 'تل دور ومرفأ قديم وشواطئ صخرية.',                           anchor: 'hist-tel-dor' },
    { id: 'coastnorth', r: 'N', nameByLang: { ar: 'شمال الساحل', he: 'צפון החוף', en: 'Northern Coast' }, name: 'شمال الساحل',       blurb: 'نحال تانينيم وقنوات مياه رومانية.',                          anchor: 'taninim' },
    { id: 'galilee',    r: 'N', nameByLang: { ar: 'الجليل والمرج', he: 'הגליל והעמק', en: 'Galilee and the Valley' }, name: 'الجليل والمرج',     blurb: 'عكا وصفورية ومجدو وأربيل وتل دان — أكبر تجمّع مواقع في الدليل.', anchor: 'hist-jazzar' },
    { id: 'golan',      r: 'N', nameByLang: { ar: 'بانياس والجولان', he: 'בניאס והגולן', en: 'Banias and the Golan' }, name: 'بانياس والجولان',   blurb: 'شلال بانياس ومجرى مائي دائم وغابات ظليلة.',                  anchor: 'banias-fall' }
  ];

  /* عناوين ويكيبيديا الاحتياطية للمسارات التي لا تحمل photoWiki.
     تُستعمل للصورة وللإحداثيات المرجعية معًا. */
  w.DOROUB_WIKI_FALLBACK = {
    tamar: 'Nahal Tamar', shlomo: 'Eilat Mountains', neshef: 'Eilat Mountains', barak: 'Nahal Barak',
    hidden: 'Eilat Mountains', gishron: 'Eilat Mountains', netafim: 'Ein Netafim', valley: 'Eilat Mountains',
    redcanyon: 'Red Canyon (Eilat)', arava1: 'Arabah', arava2: 'Arabah', darga: 'Nahal Darga',
    't-arches': 'Timna Valley', 't-pillars': 'Timna Valley', 't-adv': 'Timna Valley',
    apollonia: 'Apollonia–Arsuf', 'int-coast': 'Herzliya', 'hof-hasharon': 'Hof HaSharon Regional Council',
    alexander: 'Alexander River (Israel)', poleg: 'Poleg', yakum: 'Yakum', palmahim: 'Palmachim',
    ayalon7: 'Canada Park', 'ayalon-aq': 'Canada Park', 'ayalon-arch': 'Canada Park',
    'sataf-combo': 'Sataf', 'sataf-rain': 'Sataf', 'sataf-eitan': 'Sataf',
    'ein-david': 'Ein Gedi', arugot: 'Ein Gedi', 'ein-avdat': 'Ein Avdat',
    'ramon-colors': 'Makhtesh Ramon', 'ramon-view': 'Makhtesh Ramon',
    'masada-snake': 'Masada', 'masada-ramp': 'Masada', lahav: 'Lahav Forest',
    'tel-dan': 'Tel Dan', banias: 'Banias', 'banias-fall': 'Banias', arbel: 'Mount Arbel',
    taninim: 'Taninim Stream', 'beit-shean': 'Valley of Springs', 'wadi-qelt': 'Wadi Qelt',
    yarkon: 'Yarkon River', afek: 'Antipatris'
  };

  /* صور موثّقة بملفاتها على ويكيميديا كومنز — تُحمَّل فورًا دون أي استعلام. */
  w.DOROUB_PHOTO_FILES = {
    redcanyon:       { file: 'Red Canyon.jpg',                            credit: 'Ratoncito Perez · CC0' },
    't-pillars':     { file: "Solomon's Pillars Timna Park.jpg",          credit: 'Tiia Monto · Wikimedia Commons' },
    'ein-avdat':     { file: 'En-avedat-upper-entrance-canyon.JPG',       credit: 'Mboesch · Wikimedia Commons' },
    'masada-snake':  { file: 'Sunrise from Masada.jpg',                   credit: 'Wikimedia Commons · CC0' },
    'banias-fall':   { file: 'Banias 1.JPG',                              credit: 'Pacman · Wikimedia Commons' }
  };

  /* مجموعات جاهزة: أماكن منفصلة مقترحة معًا، وليست خط مشي واحدًا. */
  w.DOROUB_COLLECTIONS = [
    { id: 'ramla-islamic', title: 'رملة التراث الإسلامي', sub: 'جامع كبير وبرج مملوكي وبركة عباسية', anchor: 'hist-white-tower', ids: ['hist-ramla-mosque', 'hist-white-tower', 'hist-arches-pool'] },
    { id: 'nabatean',      title: 'المدن النبطية في النقب', sub: 'ممشيت وعبدة وشبطا على طريق البخور', anchor: 'hist-avdat', ids: ['hist-mamshit', 'hist-avdat', 'hist-shivta'] },
    { id: 'galilee-heritage', title: 'آثار الجليل والمرج', sub: 'صفورية ومجدو وحاصور', anchor: 'hist-tzipori', ids: ['hist-tzipori', 'hist-megiddo', 'hist-hazor'] },
    { id: 'coastal',       title: 'آثار الساحل', sub: 'ميناء قيسارية وتل دور ومدينة عسقلان', anchor: 'hist-caesarea', ids: ['hist-caesarea', 'hist-tel-dor', 'hist-ashkelon'] },
    { id: 'ramla-faiths',  title: 'الرملة عبر الديانات', sub: 'مسجد قديم وكنائس تاريخية', anchor: 'hist-ramla-george', ids: ['hist-ramla-mosque', 'hist-ramla-franciscan', 'hist-ramla-george'] },
    { id: 'faith',         title: 'مواقع ذات تاريخ ديني', sub: 'النبي صموئيل وكورسي وبيت ألفا', anchor: 'hist-nebi-samuel', ids: ['hist-nebi-samuel', 'hist-kursi', 'hist-alpha'] },
    { id: 'water',         title: 'يوم على الماء', sub: 'بانياس وتل دان وعين جدي', anchor: 'tel-dan', ids: ['banias-fall', 'tel-dan', 'ein-david'] },
    { id: 'family',        title: 'سهلة مع العائلة', sub: 'مسارات قصيرة ومستوية', anchor: 'alexander', ids: ['alexander', 'yarkon', 'ayalon7'] }
  ];

  /* ---------------------------------------------------------------
     المواسم: إرشاد على مستوى المنطقة الطبيعية لا المكان المفرد.
     هذه ليست بيانات ميدانية لكل مسار، بل خصائص مناخية عامة للمنطقة،
     ولذلك تُعرض موسومة بمصدرها ولا تُغني عن التحذيرات الرسمية.
     best: الأشهر المناسبة · avoid: الأشهر التي يُنصح بتجنّبها
     risk: نوع الخطر الموسمي الغالب · flood: هل المنطقة معرّضة للسيول
     --------------------------------------------------------------- */
  w.DOROUB_SEASONS = {
    eilat:      { best: [11,12,1,2,3], avoid: [6,7,8,9], flood: true,
                  summer: 'حرارة شديدة في جبال إيلات صيفًا، والمسارات الصخرية تخزّن الحرارة بعد الغروب.',
                  winter: 'الأودية الضيقة هنا تسيل بسرعة عند المطر حتى لو كان بعيدًا.' },
    timna:      { best: [11,12,1,2,3], avoid: [6,7,8,9], flood: true,
                  summer: 'وادٍ صحراوي مكشوف بلا ظل تقريبًا؛ الحرارة صيفًا خطرة.',
                  winter: 'مجارٍ جافة قد تسيل فجأة عند المطر على الجبال.' },
    negev:      { best: [11,12,1,2,3,4], avoid: [6,7,8], flood: true,
                  summer: 'النقب شديد الحرارة صيفًا، والمسافات بين نقاط الماء طويلة.',
                  winter: 'أخاديد عين عفدات ومكتش رامون تسيل عند المطر.' },
    dead:       { best: [11,12,1,2,3], avoid: [5,6,7,8,9], flood: true,
                  summer: 'أخفض بقعة على الأرض وأشدّها حرًّا؛ تُغلق مسارات عين جدي في الحر الشديد.',
                  winter: 'أودية البحر الميت من أخطر مناطق السيول في المنطقة.' },
    jer:        { best: [10,11,12,1,2,3,4,5], avoid: [7,8], flood: true,
                  summer: 'ظل جزئي في تراسات سطاف، لكن الظهيرة صيفًا شاقة.',
                  winter: 'وادي القلط ومجاري جبال القدس تسيل عند المطر الغزير.' },
    shfela:     { best: [10,11,12,1,2,3,4,5], avoid: [7,8], flood: false,
                  summer: 'سهل مكشوف وحرارة عالية ظهرًا؛ المواقع الأثرية بلا ظل.',
                  winter: 'طين ثقيل في الدروب الترابية بعد المطر.' },
    coast:      { best: [10,11,12,1,2,3,4,5,6], avoid: [8], flood: false,
                  summer: 'رطوبة عالية على الساحل، والمشي الطويل مرهق رغم اعتدال الحرارة.',
                  winter: 'موسم ممتاز؛ انتبه لارتفاع الموج قرب الجروف.' },
    south_coast:{ best: [10,11,12,1,2,3,4,5], avoid: [7,8], flood: false,
                  summer: 'حرّ ورطوبة معًا؛ المواقع الأثرية مكشوفة.',
                  winter: 'موسم مناسب، مع احتمال إغلاق مؤقت بعد العواصف.' },
    carmel:     { best: [10,11,12,1,2,3,4,5], avoid: [8], flood: false,
                  summer: 'خطر حرائق مرتفع في أشهر الصيف الجافة؛ التزم بالمسارات.',
                  winter: 'خضرة كثيفة وطقس مثالي.' },
    coastnorth: { best: [10,11,12,1,2,3,4,5,6], avoid: [8], flood: false,
                  summer: 'رطوبة عالية؛ المجاري المائية تخفّف الحرّ قليلًا.',
                  winter: 'تدفّق المياه في أعلى مستوياته.' },
    galilee:    { best: [10,11,12,1,2,3,4,5], avoid: [8], flood: false,
                  summer: 'حرّ في المرج والأغوار، وأخفّ في الجليل الأعلى.',
                  winter: 'أجمل مواسم الجليل خضرةً؛ الدروب الترابية تصير طينية.' },
    golan:      { best: [3,4,5,10,11], avoid: [8], flood: true,
                  summer: 'الماء الدائم يلطّف الجوّ، لكن الازدحام في ذروته.',
                  winter: 'برد شديد وثلج أحيانًا، وتدفّق قوي في بانياس.' }
  };

  /* أسماء الأشهر للعرض. */
  w.DOROUB_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

  /* قائمة تجهيزات تُحفظ على جهاز الزائر فقط. */
  w.DOROUB_CHECKS = [
    'ماء للشرب بحسب الطقس والمدة',
    'حذاء مشي مناسب',
    'قبعة وواقي شمس',
    'هاتف مشحون وبطارية احتياطية',
    'خريطة موثوقة محفوظة قبل الخروج',
    'فحص الحرارة والسيول والتحذيرات',
    'التحقق من فتح المسار والرسوم والحجز',
    'إبلاغ شخص بوقت الانطلاق والعودة'
  ];
})(window);
