/* دُروب V8 — طبقة المناطق والتصنيفات.
   تُبنى فوق data/trails.js و data/heritage.js دون تغيير بياناتهما الأصلية. */
(function (w) {
  'use strict';

  /* ثلاث مناطق رئيسية، لكل واحدة صورة مرساة من مكان موثّق داخل الدليل. */
  w.DOROUB_REGIONS = [
    {
      id: 'S', name: 'الجنوب والنقب',
      tagline: 'صحراء وأخاديد وألوان لا تتكرر',
      blurb: 'من جبال إيلات الحمراء إلى مكتش رامون والمدن النبطية، منطقة الصحراء والمغامرات الطويلة.',
      anchor: 'redcanyon', accent: '#d08a3f'
    },
    {
      id: 'C', name: 'المركز والقدس',
      tagline: 'طبيعة وآثار على بُعد نصف ساعة',
      blurb: 'ينابيع سطاف وأودية القدس، وساحل الوسط، وآثار الرملة واللطرون — قريبة وسهلة الوصول.',
      anchor: 'sataf-combo', accent: '#4f9d62'
    },
    {
      id: 'N', name: 'الشمال والجليل',
      tagline: 'مياه وخضرة وحكايات حضارات',
      blurb: 'بانياس وتل دان وأربيل وعكا وصفورية — ماء دائم، غابات، ومواقع أثرية من كل العصور.',
      anchor: 'banias-fall', accent: '#2f8f93'
    }
  ];

  /* المناطق الفرعية: الاسم العربي، وصف قصير، ومكان مرساة للصورة. */
  w.DOROUB_ZONES = [
    { id: 'eilat',      r: 'S', name: 'جبال إيلات',        blurb: 'جبال حمراء وأخاديد ضيقة ومسارات شاقة قرب خليج العقبة.',       anchor: 'redcanyon' },
    { id: 'timna',      r: 'S', name: 'وادي تمناع',        blurb: 'أعمدة سليمان والأقواس الصخرية وتاريخ تعدين النحاس.',          anchor: 't-pillars' },
    { id: 'negev',      r: 'S', name: 'النقب ومكتش رامون', blurb: 'فوهة رامون وعين عفدات والمدن النبطية عبدة وشبطا وممشيت.',     anchor: 'ein-avdat' },
    { id: 'dead',       r: 'S', name: 'البحر الميت والعربة', blurb: 'عين جدي ومسادا وأودية منحدرة نحو أخفض بقعة على الأرض.',    anchor: 'masada-snake' },
    { id: 'jer',        r: 'C', name: 'جبال القدس',        blurb: 'سطاف ووادي القلط وتراسات زراعية وينابيع قديمة.',             anchor: 'sataf-combo' },
    { id: 'shfela',     r: 'C', name: 'السهل والرملة',     blurb: 'آثار الرملة الإسلامية، كنيسة اللطرون، وبيت جبرين.',          anchor: 'hist-white-tower' },
    { id: 'coast',      r: 'C', name: 'ساحل الوسط',        blurb: 'قيسارية وأبولونيا وأنهار الساحل ومسارات عائلية مستوية.',      anchor: 'hist-caesarea' },
    { id: 'south_coast', r: 'C', name: 'الساحل الجنوبي',   blurb: 'عسقلان وآثارها الكنعانية والرومانية على البحر.',             anchor: 'hist-ashkelon' },
    { id: 'carmel',     r: 'N', name: 'ساحل الكرمل',       blurb: 'تل دور ومرفأ قديم وشواطئ صخرية.',                           anchor: 'hist-tel-dor' },
    { id: 'coastnorth', r: 'N', name: 'شمال الساحل',       blurb: 'نحال تانينيم وقنوات مياه رومانية.',                          anchor: 'taninim' },
    { id: 'galilee',    r: 'N', name: 'الجليل والمرج',     blurb: 'عكا وصفورية ومجدو وأربيل وتل دان — أكبر تجمّع مواقع في الدليل.', anchor: 'hist-jazzar' },
    { id: 'golan',      r: 'N', name: 'بانياس والجولان',   blurb: 'شلال بانياس ومجرى مائي دائم وغابات ظليلة.',                  anchor: 'banias-fall' }
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
