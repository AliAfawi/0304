/* دُروب V10 — طبقة اللغات: عربية وعبرية وإنجليزية.

   المبدأ: تُترجم الواجهة كاملة، أما نصوص الأماكن فتبقى بلغة مصدرها
   ويُقال للزائر صراحةً بأي لغة هي. لا نترجم آليًا نصًّا موسوعيًا
   ثم نقدّمه كأنه موثوق.

   الاتجاه: العربية والعبرية من اليمين، والإنجليزية من اليسار. */
window.DI18N = (function (w) {
  'use strict';

  const LANGS = {
    ar: { name: 'العربية', dir: 'rtl', html: 'ar' },
    he: { name: 'עברית', dir: 'rtl', html: 'he' },
    en: { name: 'English', dir: 'ltr', html: 'en' }
  };

  /* جدول النصوص. المفتاح وصفي، والعربية هي المرجع. */
  const S = {
    /* --- الهيكل والتنقّل --- */
    'app.tagline':        ['خُطاك إلى الطبيعة', 'הצעדים שלך אל הטבע', 'Your steps into nature'],
    'nav.home':           ['الرئيسية', 'בית', 'Home'],
    'nav.explore':        ['استكشف', 'חיפוש', 'Explore'],
    'nav.map':            ['الخريطة', 'מפה', 'Map'],
    'nav.trip':           ['رحلتي', 'הטיול שלי', 'My trip'],
    'a11y.search':        ['ابحث عن مكان', 'חיפוש מקום', 'Search for a place'],
    'a11y.settings':      ['الإعدادات', 'הגדרות', 'Settings'],
    'a11y.close':         ['إغلاق', 'סגירה', 'Close'],
    'a11y.mainNav':       ['التنقل الرئيسي', 'ניווט ראשי', 'Main navigation'],

    /* --- الواجهة الأولى --- */
    'home.eyebrow':       ['دليلك للطبيعة والتراث', 'המדריך שלך לטבע ולמורשת', 'Your guide to nature and heritage'],
    'home.title1':        ['الطبيعة تناديك.', 'הטבע קורא לך.', 'Nature is calling.'],
    'home.title2':        ['وين دربك اليوم؟', 'לאן הדרך שלך היום?', 'Where does your path lead today?'],
    'home.sub':           ['{n} مسارًا وموقعًا بين النقب والجليل، بمعلومات من مصادرها وخرائط داخل الموقع.',
                           '{n} מסלולים ואתרים בין הנגב לגליל, עם מקורות למידע ומפות בתוך האתר.',
                           '{n} trails and sites between the Negev and the Galilee, with sourced information and maps built in.'],
    'home.cta':           ['ابدأ الاستكشاف', 'התחילו לחקור', 'Start exploring'],
    'home.near':          ['القريب مني', 'קרוב אליי', 'Near me'],
    'home.statPlaces':    ['مسار وموقع', 'מסלולים ואתרים', 'trails and sites'],
    'home.statCoords':    ['بإحداثيات على الخريطة', 'עם נקודה על המפה', 'placed on the map'],
    'home.statCurated':   ['موثّق في الدليل', 'מתועד במדריך', 'verified in the guide'],
    'home.regions':       ['اختر منطقتك', 'בחרו אזור', 'Choose your region'],
    'home.regionsSub':    ['ثلاث مناطق كبرى، اضغط لترى ما فيها', 'שלושה אזורים גדולים — הקישו לראות מה בהם', 'Three main regions — tap to see what is in them'],
    'home.zones':         ['المناطق الطبيعية', 'אזורי טבע', 'Natural areas'],
    'home.zonesSub':      ['من جبال إيلات إلى بانياس', 'מהרי אילת ועד הבניאס', 'From the Eilat mountains to Banias'],
    'home.onMap':         ['على الخريطة', 'על המפה', 'On the map'],
    'home.picks':         ['وجهات مختارة', 'יעדים נבחרים', 'Selected destinations'],
    'home.picksSub':      ['بدايات جيدة إن لم تقرّر بعد', 'נקודת פתיחה טובה אם עוד לא החלטתם', 'A good start if you have not decided'],
    'home.all':           ['الكل', 'הכול', 'All'],
    'home.tours':         ['جولات جاهزة', 'סיורים מוכנים', 'Ready-made tours'],
    'home.toursSub':      ['أماكن منفصلة مقترحة معًا — وليست خط مشي واحدًا',
                           'מקומות נפרדים המוצעים יחד — לא מסלול רציף אחד',
                           'Separate places suggested together — not one continuous route'],
    'home.recent':        ['تابع من حيث وقفت', 'המשיכו מהמקום שעצרתם', 'Pick up where you left off'],
    'home.recentSub':     ['آخر ما تصفّحته على هذا الجهاز', 'מה שצפיתם לאחרונה במכשיר הזה', 'Recently viewed on this device'],
    'home.clear':         ['امسح', 'מחיקה', 'Clear'],
    'home.placesCount':   ['{n} موقعًا', '{n} אתרים', '{n} sites'],

    /* --- عن الموقع --- */
    'about.title':        ['عن دُروب', 'על دُروب', 'About Doroub'],
    'about.body':         ['دليل لاكتشاف مسارات المشي والمواقع الطبيعية والتاريخية. نذكر مصدر كل معلومة، ونوضّح ما لم يتم التحقق منه بدل إخفائه.',
                           'מדריך לגילוי מסלולי הליכה ואתרי טבע והיסטוריה. אנחנו מציינים מקור לכל פריט מידע, ומסמנים במפורש מה לא אומת במקום להסתיר אותו.',
                           'A guide to walking trails and natural and historic sites. We cite a source for every fact, and mark what is unverified rather than hiding it.'],
    'about.p1t':          ['لا نرسم مسارات مخمّنة', 'איננו משרטטים מסלולים משוערים', 'We never draw a guessed route'],
    'about.p1b':          ['خط المشي يظهر فقط من ملف حقيقي تستورده أو من مصدر رسمي.',
                           'קו ההליכה מוצג רק מקובץ אמיתי שאתם מייבאים או ממקור רשמי.',
                           'A route line appears only from a real file you import or an official source.'],
    'about.p2t':          ['نفرّق بين النقطة والمنطقة', 'מבחינים בין נקודה לאזור', 'We distinguish a point from an area'],
    'about.p2b':          ['الدبوس موقع معلم موثق، والدائرة منطقة تقريبية لا تصلح للتوجه.',
                           'הסיכה היא מיקום אתר מתועד, והעיגול הוא אזור משוער שאינו מתאים לניווט.',
                           'A pin is a documented landmark; a circle is an approximate area, not something to navigate by.'],
    'about.p3t':          ['ساعات الزيارة منشورة لا لحظية', 'שעות ביקור מפורסמות, לא בזמן אמת', 'Opening hours are published, not live'],
    'about.p3b':          ['نذكر تاريخ آخر مراجعة، وتبقى الحاجة للتأكد هاتفيًا.',
                           'אנחנו מציינים את מועד הבדיקה האחרון, ועדיין כדאי לאמת טלפונית.',
                           'We state when we last checked; calling ahead is still needed.'],
    'about.p4t':          ['الصور من مصادرها', 'תמונות ממקורן', 'Photos from their source'],
    'about.p4b':          ['ويكيميديا كومنز وويكيبيديا مع الرخصة؛ ولا نضع صورة مكان آخر.',
                           'ויקישיתוף וויקיפדיה עם הרישיון; ולעולם לא תמונה של מקום אחר.',
                           'Wikimedia Commons and Wikipedia with their licence; never a photo of a different place.'],
    'about.legal':        ['© ٢٠٢٦ دُروب · الخرائط بواسطة Leaflet وبلاطات OpenStreetMap وOpenTopoMap · الطقس من Open-Meteo · المعلومات قابلة للتغيير، والمسؤولية عن السلامة تبقى على الزائر.',
                           '© 2026 دُروب · מפות באמצעות Leaflet ואריחי OpenStreetMap ו-OpenTopoMap · מזג אוויר מ-Open-Meteo · המידע עשוי להשתנות, והאחריות לבטיחות היא על המבקר.',
                           '© 2026 Doroub · Maps by Leaflet with OpenStreetMap and OpenTopoMap tiles · Weather from Open-Meteo · Information may change; safety remains the visitor’s responsibility.'],

    /* --- الاستكشاف --- */
    'explore.placeholder': ['ابحث عن مسار، مسجد، قلعة، وادٍ أو مدينة…', 'חפשו מסלול, מסגד, מצודה, ואדי או עיר…', 'Search a trail, mosque, fort, wadi or town…'],
    'explore.count':       ['{n} من {total} وجهة', '{n} מתוך {total} יעדים', '{n} of {total} destinations'],
    'explore.hintTap':     ['اضغط البطاقة لكل التفاصيل', 'הקישו על הכרטיס לכל הפרטים', 'Tap a card for full details'],
    'explore.hintFav':     ['المحفوظة على جهازك', 'השמורים במכשיר שלך', 'Saved on your device'],
    'explore.hintNear':    ['مرتّبة بالمسافة الجوية', 'ממוינים לפי מרחק אווירי', 'Sorted by straight-line distance'],
    'explore.hintSeason':  ['ما يناسب الموسم الحالي', 'מה שמתאים לעונה הנוכחית', 'Suited to the current season'],
    'explore.hintBounds':  ['ضمن إطار الخريطة الحالي', 'בתוך תחום המפה הנוכחי', 'Within the current map view'],
    'explore.hintRadius':  ['ضمن {n} كم منك', 'עד {n} ק״מ ממך', 'Within {n} km of you'],
    'explore.emptyTitle':  ['لا توجد نتائج بهذه الشروط', 'אין תוצאות לתנאים האלה', 'No results for these filters'],
    'explore.emptyBody':   ['جرّب منطقة أخرى أو أزل أحد الفلاتر.', 'נסו אזור אחר או הסירו מסנן.', 'Try another region or remove a filter.'],
    'explore.showAll':     ['إظهار كل الوجهات', 'הצג את כל היעדים', 'Show all destinations'],
    'explore.more':        ['عرض {n} وجهة أخرى', 'הצג עוד {n} יעדים', 'Show {n} more'],
    'explore.favourites':  ['المفضلة', 'מועדפים', 'Favourites'],

    /* --- الفلاتر --- */
    'filters.title':       ['الفلاتر والترتيب', 'מסננים ומיון', 'Filters and sorting'],
    'filters.apply':       ['اعرض {n} وجهة', 'הצג {n} יעדים', 'Show {n} destinations'],
    'filters.clear':       ['مسح الكل', 'נקה הכול', 'Clear all'],
    'filters.region':      ['المنطقة', 'אזור', 'Region'],
    'filters.zone':        ['المنطقة الطبيعية', 'אזור טבע', 'Natural area'],
    'filters.level':       ['الصعوبة', 'דרגת קושי', 'Difficulty'],
    'filters.kind':        ['نوع المكان', 'סוג האתר', 'Type of place'],
    'filters.visit':       ['حالة الزيارة', 'מצב ביקור', 'Visiting status'],
    'filters.era':         ['الحضارة', 'תקופה', 'Era'],
    'filters.radius':      ['ضمن مسافة مني', 'במרחק ממני', 'Within distance of me'],
    'filters.provenance':  ['مصدر البيانات', 'מקור הנתונים', 'Data source'],
    'filters.sort':        ['الترتيب', 'מיון', 'Sorting'],
    'filters.scope':       ['نطاق البحث', 'תחום החיפוש', 'Search scope'],
    'filters.season':      ['ما يناسب الموسم الآن', 'מה שמתאים לעונה עכשיו', 'In season now'],
    'filters.bounds':      ['ضمن إطار الخريطة فقط', 'רק בתחום המפה', 'Only within the map view'],
    'filters.surprise':    ['فاجئني بمكان', 'הפתיעו אותי', 'Surprise me'],
    'filters.noLimit':     ['بلا حد', 'ללא הגבלה', 'No limit'],
    'filters.curated':     ['الدليل المحرَّر', 'המדריך הערוך', 'Curated guide'],
    'filters.open':        ['مصدر مفتوح', 'מקור פתוח', 'Open source data'],

    /* --- التسميات --- */
    'level.easy':   ['سهل', 'קל', 'Easy'],
    'level.mid':    ['متوسط', 'בינוני', 'Moderate'],
    'level.hard':   ['صعب', 'קשה', 'Hard'],
    'level.exp':    ['متقدم', 'מתקדם', 'Advanced'],
    'level.unk':    ['غير محدد', 'לא ידוע', 'Unspecified'],
    'region.S':     ['الجنوب والنقب', 'הדרום והנגב', 'South and Negev'],
    'region.C':     ['المركز والقدس', 'המרכז וירושלים', 'Centre and Jerusalem'],
    'region.N':     ['الشمال والجليل', 'הצפון והגליל', 'North and Galilee'],
    'kind.trail':     ['مسار مشي', 'מסלול הליכה', 'Walking trail'],
    'kind.nature':    ['معلم طبيعي', 'אתר טבע', 'Natural site'],
    'kind.ruins':     ['موقع أثري', 'אתר ארכאולוגי', 'Archaeological site'],
    'kind.mosque':    ['مسجد تاريخي', 'מסגד היסטורי', 'Historic mosque'],
    'kind.maqam':     ['مقام', 'מקאם', 'Shrine'],
    'kind.religious': ['معلم ديني', 'אתר דתי', 'Religious site'],
    'visit.hours':       ['ساعات منشورة', 'שעות מפורסמות', 'Published hours'],
    'visit.appointment': ['حجز مسبق', 'בתיאום מראש', 'By appointment'],
    'visit.unknown':     ['تأكد من الفتح', 'ודאו שפתוח', 'Check if open'],
    'theme.all':       ['الكل', 'הכול', 'All'],
    'theme.water':     ['مياه وشلالات', 'מים ומפלים', 'Water and waterfalls'],
    'theme.views':     ['جبال وإطلالات', 'הרים ותצפיות', 'Mountains and views'],
    'theme.forest':    ['غابات وخضرة', 'יערות וירק', 'Forests and greenery'],
    'theme.desert':    ['صحراء وأودية', 'מדבר ונחלים', 'Desert and wadis'],
    'theme.family':    ['للعائلة', 'למשפחה', 'For families'],
    'theme.history':   ['تاريخ وآثار', 'היסטוריה וארכאולוגיה', 'History and ruins'],
    'theme.religious': ['معالم دينية', 'אתרי דת', 'Religious sites'],

    /* --- صفحة المكان --- */
    'place.distance':   ['المسافة', 'מרחק', 'Distance'],
    'place.visitKind':  ['نوع الزيارة', 'סוג הביקור', 'Visit type'],
    'place.duration':   ['المدة', 'משך', 'Duration'],
    'place.climb':      ['الصعود', 'טיפוס', 'Ascent'],
    'place.era':        ['الحضارة', 'תקופה', 'Era'],
    'place.level':      ['الصعوبة', 'קושי', 'Difficulty'],
    'place.siteTour':   ['جولة موقع', 'סיור באתר', 'Site visit'],
    'place.byVisit':    ['حسب الزيارة', 'לפי הביקור', 'Varies'],
    'place.undocumented': ['غير موثّقة', 'לא מתועד', 'Not documented'],
    'place.highlight':  ['ما يميّز المكان', 'מה מייחד את המקום', 'What makes it special'],
    'place.visiting':   ['الزيارة والمواعيد', 'ביקור ושעות', 'Visiting and hours'],
    'place.before':     ['قبل الانطلاق', 'לפני היציאה', 'Before you go'],
    'place.map':        ['الخريطة', 'מפה', 'Map'],
    'place.story':      ['الحكاية', 'הסיפור', 'The story'],
    'place.about':      ['نبذة عن المكان', 'על המקום', 'About this place'],
    'place.access':     ['كيف تصل', 'איך מגיעים', 'Getting there'],
    'place.weather':    ['الطقس وتوقّعات الأسبوع', 'מזג אוויר ותחזית שבועית', 'Weather and weekly forecast'],
    'place.sun':        ['الشمس ووقت العودة الآمن', 'שמש וזמן חזרה בטוח', 'Sun and safe return time'],
    'place.photos':     ['صور المكان', 'תמונות המקום', 'Photos'],
    'place.mine':       ['ملاحظاتي وزياراتي', 'הערות וביקורים שלי', 'My notes and visits'],
    'place.offline':    ['احفظ هذا المكان للعمل دون اتصال', 'שמירת המקום לשימוש ללא רשת', 'Save this place for offline use'],
    'place.kit':        ['قائمة التجهيزات', 'רשימת ציוד', 'Kit checklist'],
    'place.allFacts':   ['كل التفاصيل المسجّلة', 'כל הפרטים המתועדים', 'All recorded details'],
    'place.sources':    ['المصادر والصور', 'מקורות ותמונות', 'Sources and photos'],
    'place.others':     ['أماكن أخرى', 'מקומות נוספים', 'Other places'],
    'place.addTrip':    ['أضف إلى رحلتي', 'הוספה לטיול שלי', 'Add to my trip'],
    'place.inTrip':     ['في رحلتي', 'בטיול שלי', 'In my trip'],
    'place.food':       ['أماكن للأكل والقهوة قريبًا', 'מקומות לאכול ולקפה בסביבה', 'Food and coffee nearby'],
    'place.accessibility': ['الوصول والإتاحة', 'נגישות והגעה', 'Access and accessibility'],

    /* --- اللغة --- */
    'lang.label':      ['لغة الواجهة', 'שפת הממשק', 'Interface language'],
    'lang.textNote':   ['نصوص الأماكن تبقى بلغة مصدرها، ونوضّح لغة كل نص.',
                        'טקסטי המקומות נשארים בשפת המקור, ואנחנו מציינים את שפת כל טקסט.',
                        'Place texts stay in their source language, and we state which language each one is in.'],
    'lang.arOnly':     ['هذا النص متاح بالعربية فقط.', 'הטקסט הזה זמין בערבית בלבד.', 'This text is available in Arabic only.'],
    'lang.heOnly':     ['هذا النص متاح بالعبرية فقط.', 'הטקסט הזה זמין בעברית בלבד.', 'This text is available in Hebrew only.'],
    'lang.enOnly':     ['هذا النص متاح بالإنجليزية فقط.', 'הטקסט הזה זמין באנגלית בלבד.', 'This text is available in English only.'],
    'lang.nameAr':     ['الاسم بالعربية', 'השם בערבית', 'Arabic name'],
    'lang.nameHe':     ['الاسم بالعبرية', 'השם בעברית', 'Hebrew name'],
    'lang.nameEn':     ['الاسم بالإنجليزية', 'השם באנגלית', 'English name'],

    /* --- الإعدادات --- */
    'set.title':       ['الإعدادات', 'הגדרות', 'Settings'],
    'set.theme':       ['المظهر', 'מראה', 'Appearance'],
    'set.auto':        ['حسب الجهاز', 'לפי המכשיר', 'Match device'],
    'set.light':       ['فاتح', 'בהיר', 'Light'],
    'set.dark':        ['داكن', 'כהה', 'Dark'],
    'set.font':        ['حجم الخط', 'גודל הטקסט', 'Text size'],
    'set.fontN':       ['عادي', 'רגיל', 'Normal'],
    'set.fontL':       ['كبير', 'גדול', 'Large'],
    'set.fontXL':      ['أكبر', 'גדול מאוד', 'Larger'],
    'set.units':       ['وحدة القياس', 'יחידות מידה', 'Units'],
    'set.km':          ['كيلومتر', 'קילומטר', 'Kilometres'],
    'set.mi':          ['ميل', 'מייל', 'Miles'],
    'set.pace':        ['سرعة مشيك (لتقدير الزمن)', 'קצב ההליכה שלך (לאומדן זמן)', 'Your walking pace (for time estimates)'],
    'set.paceSlow':    ['متأنّية ٣', 'נינוח 3', 'Relaxed 3'],
    'set.paceMid':     ['عادية ٤٫٥', 'רגיל 4.5', 'Normal 4.5'],
    'set.paceFast':    ['سريعة ٦', 'מהיר 6', 'Fast 6'],
    'set.motion':      ['الحركة والانتقالات', 'אנימציות ומעברים', 'Motion and transitions'],
    'set.motionFull':  ['كاملة', 'מלאות', 'Full'],
    'set.motionLess':  ['مخفّفة', 'מופחתות', 'Reduced'],
    'set.data':        ['بياناتك على هذا الجهاز', 'הנתונים שלך במכשיר', 'Your data on this device'],
    'set.export':      ['تصدير نسخة', 'ייצוא גיבוי', 'Export a backup'],
    'set.import':      ['استيراد نسخة', 'ייבוא גיבוי', 'Import a backup'],
    'set.clearPhotos': ['تفريغ ذاكرة الصور', 'ניקוי מטמון תמונות', 'Clear photo cache'],
    'set.app':         ['التطبيق', 'האפליקציה', 'App'],
    'set.install':     ['ثبّت دُروب على جهازك', 'התקינו את دُروب במכשיר', 'Install Doroub on your device'],
    'set.shortcuts':   ['اختصارات لوحة المفاتيح', 'קיצורי מקלדת', 'Keyboard shortcuts'],
    'set.iosHint':     ['للتثبيت على آيفون: زر المشاركة في Safari ثم «إضافة إلى الشاشة الرئيسية».',
                        'להתקנה באייפון: כפתור השיתוף ב-Safari ואז «הוספה למסך הבית».',
                        'To install on iPhone: the Share button in Safari, then “Add to Home Screen”.'],
    'set.privacy':     ['كل شيء محفوظ على جهازك وحده. التصدير يتيح نقله إلى جهاز آخر.',
                        'הכול נשמר במכשיר שלך בלבד. הייצוא מאפשר להעביר למכשיר אחר.',
                        'Everything is stored on your device only. Export lets you move it to another device.'],
    'set.favCount':    ['{n} مفضلة', '{n} מועדפים', '{n} favourites'],
    'set.tripCount':   ['{n} رحلة', '{n} טיולים', '{n} trips'],
    'set.visitCount':  ['{n} مكانًا زرته', '{n} מקומות שביקרת', '{n} places visited'],
    'set.noteCount':   ['{n} ملاحظة', '{n} הערות', '{n} notes'],

    /* --- الرحلة --- */
    'trip.title':      ['رحلتي', 'הטיול שלי', 'My trip'],
    'trip.sub':        ['خطتك ومفضلتك محفوظتان على هذا الجهاز', 'התוכנית והמועדפים שמורים במכשיר הזה', 'Your plan and favourites are saved on this device'],
    'trip.plan':       ['الخطة', 'התוכנית', 'Plan'],
    'trip.log':        ['زياراتي', 'הביקורים שלי', 'My visits'],
    'trip.name':       ['اسم الرحلة', 'שם הטיול', 'Trip name'],
    'trip.date':       ['موعد الرحلة', 'תאריך הטיול', 'Trip date'],
    'trip.notes':      ['ملاحظات', 'הערות', 'Notes'],
    'trip.new':        ['رحلة جديدة', 'טיול חדש', 'New trip'],
    'trip.emptyTitle': ['خطتك فارغة', 'התוכנית ריקה', 'Your plan is empty'],
    'trip.emptyBody':  ['افتح أي مكان واضغط «أضف إلى رحلتي».', 'פתחו מקום והקישו «הוספה לטיול שלי».', 'Open a place and tap “Add to my trip”.'],
    'trip.share':      ['شارك الخطة', 'שיתוף התוכנית', 'Share the plan'],
    'trip.print':      ['طباعة', 'הדפסה', 'Print'],
    'trip.empty':      ['إفراغ الخطة', 'ריקון התוכנית', 'Empty the plan'],
    'trip.delete':     ['احذف هذه الرحلة', 'מחיקת הטיול', 'Delete this trip'],
    'trip.compare':    ['قارن محطات الرحلة', 'השוואת תחנות', 'Compare stops'],
    'trip.disclaimer': ['المحطات أماكن منفصلة وليست طريقًا واحدًا متصلًا؛ خطّط الانتقال بينها وتحقق من المواعيد والحجوزات.',
                        'התחנות הן מקומות נפרדים ולא מסלול רציף אחד; תכננו את המעבר ביניהן ובדקו שעות והזמנות.',
                        'Stops are separate places, not one continuous route; plan the travel between them and check hours and bookings.'],

    /* --- عام --- */
    'common.offline':  ['أنت دون اتصال — ما حُفظ يعمل، أما الصور والخرائط فتحتاج إنترنت.',
                        'אין חיבור — מה שנשמר עובד, אבל תמונות ומפות דורשות אינטרנט.',
                        'You are offline — saved content works, but photos and maps need a connection.'],
    'common.openSrc':  ['مصدر مفتوح', 'מקור פתוח', 'Open data'],
    'common.visited':  ['زرته', 'ביקרתי', 'Visited'],
    'common.save':     ['حفظ', 'שמירה', 'Save']
  };

  const ORDER = { ar: 0, he: 1, en: 2 };
  let lang = 'ar';

  function setLang(code) {
    lang = LANGS[code] ? code : 'ar';
    const meta = LANGS[lang];
    document.documentElement.lang = meta.html;
    document.documentElement.dir = meta.dir;
    document.documentElement.dataset.lang = lang;
  }

  /* t('key', {n: 5}) — يعيد العربية إن لم تتوفر ترجمة، ولا يعيد مفتاحًا خامًا أبدًا. */
  function t(key, vars) {
    const row = S[key];
    let text = row ? (row[ORDER[lang]] || row[0]) : key;
    if (vars) for (const k of Object.keys(vars)) text = text.split('{' + k + '}').join(vars[k]);
    return text;
  }

  /* اسم المكان بلغة الواجهة، مع الرجوع إلى العربية دائمًا. */
  const NAMES = w.DOROUB_NAMES || {};
  function placeName(place) {
    if (!place) return '';
    if (lang === 'ar') return place.n;
    const row = NAMES[place.id] || {};
    if (lang === 'he') return row.he || place.n;
    return place.en || row.en || place.n;
  }
  /* الاسم الثانوي تحت العنوان — لا يكرّر الاسم الرئيسي أبدًا. */
  function placeSubName(place) {
    if (!place) return '';
    const main = placeName(place);
    const row = NAMES[place.id] || {};
    const options = lang === 'ar' ? [place.en, row.en, row.he]
      : lang === 'he' ? [place.n, place.en, row.en]
        : [place.n, row.he];
    return options.find(x => x && x !== main) || '';
  }
  /* بأي لغة نصّ الوصف الذي نعرضه؟ */
  function textLangNote(code) {
    return code === 'ar' ? t('lang.arOnly') : code === 'he' ? t('lang.heOnly') : t('lang.enOnly');
  }

  const dir = () => LANGS[lang].dir;
  const current = () => lang;
  const list = () => Object.keys(LANGS).map(code => ({ code, name: LANGS[code].name }));

  return { t, setLang, current, dir, list, placeName, placeSubName, textLangNote, LANGS };
})(window);
