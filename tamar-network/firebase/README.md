# Firebase – הפעלת האתר הרשמי (תוכן חי, טפסים ותיבת פניות, כניסת מנהל מאובטחת)

## מה Firebase נותן לאתר
- **תוכן חי:** מה שמפרסמים במצב עריכה מופיע מיד אצל כל המבקרים.
- **תיבת פניות:** כל הטפסים (הרשמה, מועמדות, תרומה, פנייה, הצטרפות, ניוזלטר) נשמרים ב-Firestore,
  ובמצב עריכה יש "תיבת פניות" עם סינון, סטטוס (חדש/בטיפול/טופל), מחיקה וייצוא לאקסל.
- **כניסת מנהל:** נכנסים עם `#admin` בסוף הכתובת (או Ctrl+Shift+E). האתר שולח **קישור כניסה חד-פעמי**
  ל-aliafawi116@gmail.com בלבד, ולוחצים עליו באותו מכשיר. אין סיסמה שאפשר לגנוב.
  ההגנה עצמה נאכפת בשרת של Google (`firestore.rules`), כך שגם מי שמעתיק את הקוד לא יכול לכתוב.

## הגדרה (פעם אחת, כ-15 דקות)
1. https://console.firebase.google.com ← **Add project** (אפשר בלי Google Analytics).
2. **Build ← Firestore Database ← Create database** ← מצב **Production** ← אזור `europe-west` (או הקרוב).
3. בלשונית **Rules** מדביקים את התוכן של `firestore.rules` ולוחצים **Publish**.
4. **Build ← Authentication ← Get started ← Sign-in method ← Email/Password**:
   מפעילים את **Email link (passwordless sign-in)** ושומרים.
5. **Authentication ← Settings ← Authorized domains:** מוסיפים את הדומיין של האתר.
6. **Project settings (⚙️) ← Your apps ← Web (</>)** ← רושמים אפליקציה ← מעתיקים את `firebaseConfig`.
   הערכים האלה **אינם סודיים** (הם מזהים ציבוריים). האבטחה היא בחוקים שבשלב 3.
7. שולחים את `firebaseConfig`, או שומרים אותו כ-`firebase-config.json` ומריצים:
   `python3 build-public.py --firebase firebase-config.json --site-url https://הדומיין`
8. אחרי העלאת `public/` לאחסון: נכנסים ל-`https://הדומיין/#admin`, מקבלים קישור למייל, נכנסים,
   ולוחצים **פרסום לכולם** פעם אחת כדי לשמור את התוכן הנוכחי ב-Firestore.

## המלצות אבטחה נוספות
- **אימות דו-שלבי** בחשבון Google של aliafawi116@gmail.com. מי ששולט במייל שולט באתר.
- **App Check** (Build ← App Check, עם reCAPTCHA) מקטין ספאם בטפסים. אפשר להוסיף בהמשך.
- **תקציב והתראות** ב-Google Cloud Billing, אם עוברים לתוכנית Blaze. בתוכנית החינמית (Spark) אין חיוב.
