// All page copy, EN + DE (Swiss: "ss", never "ß"). The page HTML ships the English.
// The client's name lives only in case.client and case.title, so anonymising is one edit.
export const STRINGS = {
  'meta.title': {
    en: 'Recuro · Less repeat work for cafés, bakeries and restaurants',
    de: 'Recuro · Weniger Routinearbeit für Cafés, Bäckereien und Restaurants',
  },
  'meta.description': {
    en: 'Recuro builds small AI systems for food businesses in Switzerland: shift planning, ordering, stock counts, cost of goods and invoices. Book a free 30-minute call.',
    de: 'Recuro baut kleine KI-Systeme für Gastronomie und Bäckereien in der Schweiz: Schichtplanung, Bestellungen, Inventur, Wareneinsatz und Rechnungen. Kostenloses 30-Minuten-Gespräch buchen.',
  },
  'meta.legalTitle': { en: 'Impressum & privacy · Recuro', de: 'Impressum & Datenschutz · Recuro' },
  'meta.legalDescription': {
    en: 'Who runs recuro.ch, and how the site handles your data.',
    de: 'Wer recuro.ch betreibt und wie die Seite mit Ihren Daten umgeht.',
  },
  'meta.notfoundTitle': { en: 'Page not found · Recuro', de: 'Seite nicht gefunden · Recuro' },

  'nav.skip': { en: 'Skip to content', de: 'Zum Inhalt springen' },
  'nav.main': { en: 'Main', de: 'Hauptnavigation' },
  'nav.home': { en: 'Recuro', de: 'Recuro' },
  'nav.services': { en: 'Services', de: 'Leistungen' },
  'nav.case': { en: 'In use', de: 'Im Einsatz' },
  'nav.about': { en: 'About', de: 'Über mich' },
  'nav.book': { en: 'Book a call', de: 'Gespräch buchen' },
  'nav.lang': { en: 'Deutsch', de: 'English' },
  'nav.langLabel': { en: 'Auf Deutsch lesen', de: 'Read in English' },
  'cta.book': { en: 'Book 30 min', de: '30 Min. buchen' },

  'hero.title': { en: 'Every week, the same hours.', de: 'Jede Woche dieselben Stunden.' },
  'hero.sub': {
    en: 'Sales, stock, orders, staff hours, costs and invoices on one platform, for cafés, bakeries and restaurants.',
    de: 'Verkauf, Lager, Bestellungen, Arbeitszeiten, Wareneinsatz und Rechnungen auf einer Plattform, für Cafés, Bäckereien und Restaurants.',
  },
  'hero.photoAlt': {
    en: 'Six brushed-steel panels floating apart in a dark room',
    de: 'Sechs gebürstete Stahlplatten, die einzeln in einem dunklen Raum schweben',
  },

  'calc.eyebrow': { en: 'Repeat work, in numbers', de: 'Routinearbeit in Zahlen' },
  'calc.prompt': {
    en: 'Ordering, stock counts, shift planning, invoices. Count the hours they take each week.',
    de: 'Bestellen, Inventur, Schichtplanung, Rechnungen. Zählen Sie die Stunden, die das jede Woche kostet.',
  },
  'calc.hours': { en: 'Hours a week', de: 'Stunden pro Woche' },
  'calc.rate': { en: 'Cost per hour, CHF', de: 'Kosten pro Stunde, CHF' },
  'calc.result': { en: 'A year', de: 'Pro Jahr' },
  'calc.hintNumber': { en: 'Please enter a number, for example 12.', de: 'Bitte geben Sie eine Zahl ein, zum Beispiel 12.' },
  'calc.hintMaxHours': { en: 'The maximum is 168 hours a week.', de: 'Maximal 168 Stunden pro Woche.' },
  'calc.hintMaxRate': { en: 'The maximum is CHF 1,000 an hour.', de: 'Maximal CHF 1’000 pro Stunde.' },
  'calc.note': {
    en: 'Your own numbers; nothing is sent anywhere. Which of those hours really need a person?',
    de: 'Ihre eigenen Zahlen, es wird nichts übermittelt. Welche dieser Stunden brauchen wirklich einen Menschen?',
  },

  'map.today': { en: 'Today', de: 'Heute' },
  'map.built': { en: 'What Recuro builds', de: 'Was Recuro baut' },
  'map.flow': { en: 'Where it goes', de: 'Wohin es fliesst' },

  'map.pos.title': { en: 'Till and sales', de: 'Kasse und Verkauf' },
  'map.pos.today': {
    en: 'The till records every sale. The report is printed at closing and filed.',
    de: 'Die Kasse erfasst jeden Verkauf. Der Tagesabschluss wird gedruckt und abgelegt.',
  },
  'map.pos.built': {
    en: 'The till on the counter stays. Recuro reads it: what sold, at what hour, on which day.',
    de: 'Die Kasse auf der Theke bleibt. Recuro liest sie aus: was verkauft wurde, zu welcher Stunde, an welchem Tag.',
  },
  'map.pos.flow': {
    en: 'Every sale lowers the stock count and shows ordering what next week will need.',
    de: 'Jeder Verkauf senkt den Lagerbestand und zeigt der Bestellung, was nächste Woche gebraucht wird.',
  },

  'map.stock.title': { en: 'Stock', de: 'Lager' },
  'map.stock.today': {
    en: 'Counted by hand with a clipboard after closing, once a week if the week allows.',
    de: 'Von Hand gezählt, mit Klemmbrett nach Ladenschluss, einmal pro Woche, wenn die Woche es zulässt.',
  },
  'map.stock.built': {
    en: 'A running count. Sales take stock out, deliveries put it back, and a short spot check corrects the difference.',
    de: 'Ein laufender Bestand. Verkäufe buchen ab, Lieferungen buchen zu, und eine kurze Stichprobe korrigiert die Differenz.',
  },
  'map.stock.flow': {
    en: 'When an item runs low, ordering already knows.',
    de: 'Wird ein Artikel knapp, weiss die Bestellung es schon.',
  },

  'map.ordering.title': { en: 'Ordering and suppliers', de: 'Bestellungen und Lieferanten' },
  'map.ordering.today': {
    en: 'Orders go out by phone and WhatsApp, from memory, usually the evening before.',
    de: 'Bestellt wird per Telefon und WhatsApp, aus dem Kopf, meist am Vorabend.',
  },
  'map.ordering.built': {
    en: 'The system drafts each order from stock and sales. A person checks it before it goes to the supplier.',
    de: 'Das System erstellt den Bestellvorschlag aus Bestand und Verkäufen. Ein Mensch prüft ihn, bevor er an den Lieferanten geht.',
  },
  'map.ordering.flow': {
    en: 'The sent order waits for its delivery note and its invoice.',
    de: 'Die verschickte Bestellung wartet auf Lieferschein und Rechnung.',
  },

  'map.staff.title': { en: 'Staff hours and payroll', de: 'Arbeitszeiten und Lohn' },
  'map.staff.tag': { en: 'Running at a client', de: 'Läuft bei einem Kunden' },
  'map.staff.today': {
    en: 'Timesheets on paper, shift swaps in a group chat, and an Excel file at month end.',
    de: 'Stundenzettel auf Papier, Schichttausch im Gruppenchat und am Monatsende eine Excel-Datei.',
  },
  'map.staff.built': {
    en: 'Staff log hours, swap shifts, report sick and request days off in a chat. The monthly statement is ready at month end.',
    de: 'Mitarbeitende erfassen Stunden, tauschen Schichten, melden sich krank und beantragen freie Tage im Chat. Die Monatsabrechnung steht am Monatsende bereit.',
  },
  'map.staff.flow': {
    en: 'Hours reach payroll already checked, and staff cost sits next to sales for each day.',
    de: 'Die Stunden kommen geprüft in der Lohnbuchhaltung an, und die Personalkosten stehen pro Tag neben dem Umsatz.',
  },

  'map.cogs.title': { en: 'Cost of goods', de: 'Wareneinsatz' },
  'map.cogs.today': {
    en: 'Calculated once, when the menu was written. Supplier prices have changed since.',
    de: 'Einmal kalkuliert, als die Karte geschrieben wurde. Die Lieferantenpreise haben sich seither geändert.',
  },
  'map.cogs.built': {
    en: 'What each product costs to make, recalculated when a supplier invoice shows a new price.',
    de: 'Was jedes Produkt in der Herstellung kostet, neu berechnet, sobald eine Lieferantenrechnung einen neuen Preis zeigt.',
  },
  'map.cogs.flow': {
    en: 'Margin per product, next to what sold.',
    de: 'Die Marge pro Produkt, neben den Verkaufszahlen.',
  },

  'map.invoices.title': { en: 'Invoices', de: 'Rechnungen' },
  'map.invoices.today': {
    en: 'Supplier invoices pile up in a folder until someone types them in.',
    de: 'Lieferantenrechnungen sammeln sich im Ordner, bis jemand sie abtippt.',
  },
  'map.invoices.built': {
    en: 'Incoming invoices are read and matched to the order and the delivery. Outgoing ones are drawn up from what was delivered.',
    de: 'Eingehende Rechnungen werden gelesen und mit Bestellung und Lieferung abgeglichen. Ausgehende entstehen aus dem, was geliefert wurde.',
  },
  'map.invoices.flow': {
    en: 'New prices go to cost of goods. Checked invoices are ready for the bookkeeper.',
    de: 'Neue Preise gehen in den Wareneinsatz. Geprüfte Rechnungen liegen für die Buchhaltung bereit.',
  },

  'flow.eyebrow': { en: 'One platform', de: 'Eine Plattform' },
  'flow.title': { en: 'The routine runs by itself.', de: 'Die Routine läuft von selbst.' },
  'flow.body': {
    en: 'A sale lowers the stock. Low stock drafts an order. The invoice is matched to that order, hours reach payroll, and the cost of each product stays current. Someone on the team approves what matters. The rest of the day goes to guests and sales.',
    de: 'Ein Verkauf senkt den Bestand. Ein knapper Bestand löst einen Bestellvorschlag aus. Die Rechnung wird mit der Bestellung abgeglichen, die Stunden kommen in der Lohnbuchhaltung an, und der Wareneinsatz pro Produkt bleibt aktuell. Jemand im Team gibt frei, was zählt. Der Rest des Tages gehört den Gästen und dem Verkauf.',
  },
  'flow.alt': {
    en: 'The six panels joined by lines of light into one map',
    de: 'Die sechs Platten, durch Lichtlinien zu einer Karte verbunden',
  },

  'rule.eyebrow': { en: 'How it works', de: 'So funktioniert es' },
  'rule.text': {
    en: 'The AI chooses. The code does the work. A person confirms.',
    de: 'Die KI wählt. Der Code erledigt die Arbeit. Ein Mensch bestätigt.',
  },
  'rule.body': {
    en: 'The language model only makes suggestions. Ordinary code does the sums and keeps the records. Nothing changes until someone on your team says yes.',
    de: 'Das Sprachmodell macht nur Vorschläge. Gewöhnlicher Code rechnet und führt die Daten. Nichts ändert sich, bevor jemand im Team zustimmt.',
  },

  'case.eyebrow': { en: 'In use', de: 'Im Einsatz' },
  'case.title': { en: 'LeBread Ops', de: 'LeBread Ops' },
  'case.client': { en: 'LeBread, Bern · bakery café', de: 'LeBread, Bern · Bäckerei-Café' },
  'case.body': {
    en: 'A staff assistant in Telegram for hours, shifts, sick leave and the monthly close. It runs in production.',
    de: 'Ein Assistent fürs Personal in Telegram: Stunden, Schichten, Krankmeldungen und Monatsabschluss. Er läuft im Produktivbetrieb.',
  },
  'case.stat1.value': { en: '4 h', de: '4 h' },
  'case.stat1.label': {
    en: 'a month saved on overtime checks (measured)',
    de: 'pro Monat gespart bei Überstundenkontrollen (gemessen)',
  },
  'case.stat2.value': { en: '−90%', de: '−90 %' },
  'case.stat2.label': {
    en: 'AI cost per request, compared with the first version',
    de: 'KI-Kosten pro Anfrage, verglichen mit der ersten Version',
  },
  'case.costNote': { en: 'Early numbers, being measured.', de: 'Erste Zahlen, Messung läuft.' },
  'case.stat3.value': { en: '1,700+', de: '1’700+' },
  'case.stat3.label': { en: 'automated tests, 99% coverage', de: 'automatisierte Tests, 99 % Abdeckung' },
  'case.photoAlt': { en: 'The counter of the bakery café', de: 'Die Theke des Bäckerei-Cafés' },

  'about.eyebrow': { en: 'About', de: 'Über mich' },
  'about.title': { en: 'Leo Neufeld', de: 'Leo Neufeld' },
  'about.body': {
    en: 'I ran operations and logistics at coffee companies in Chicago and Frankfurt before I started writing the software myself. I trained as an industrial engineer and I am studying for an M.Sc. in Data Science at BFH in Bern. I started Recuro in 2026.',
    de: 'Bevor ich selbst Software geschrieben habe, war ich für Betrieb und Logistik bei Kaffeefirmen in Chicago und Frankfurt zuständig. Ich bin Wirtschaftsingenieur und studiere im M.Sc. Data Science an der BFH in Bern. Recuro habe ich 2026 gegründet.',
  },
  'about.trackTitle': { en: 'Before Recuro', de: 'Vor Recuro' },
  'about.bunca': {
    en: 'BUNCA Coffee, Frankfurt · Logistics Lead. Product shortages −20%, delivery lead times −50% in Germany and −25% in the EU.',
    de: 'BUNCA Coffee, Frankfurt · Head of Logistics. Fehlbestände −20 %, Lieferzeiten −50 % in Deutschland und −25 % in der EU.',
  },
  'about.vigo': {
    en: 'VIGO Coffee, Chicago · Operations Manager. Returning customers +70%, raw material costs from 35% to 25%.',
    de: 'VIGO Coffee, Chicago · Operations Manager. Stammkunden +70 %, Rohstoffkosten von 35 % auf 25 %.',
  },
  'about.link': { en: 'Full background', de: 'Der ganze Werdegang' },
  'about.photoAlt': { en: 'Portrait of Leo Neufeld', de: 'Porträt von Leo Neufeld' },

  'book.eyebrow': { en: '30 minutes', de: '30 Minuten' },
  'book.title': { en: 'A free 30-minute call.', de: 'Ein kostenloses Gespräch, 30 Minuten.' },
  'book.body': {
    en: 'Bring the hours from above. We look at which tasks repeat, which could run on their own, and what that would take.',
    de: 'Bringen Sie die Stunden von oben mit. Wir schauen, welche Aufgaben sich wiederholen, welche von selbst laufen könnten und was es dafür braucht.',
  },
  'book.note': {
    en: 'Booking runs on Cal.com. What you enter there is handled under Cal.com’s privacy policy.',
    de: 'Die Buchung läuft über Cal.com. Ihre Angaben dort verarbeitet Cal.com gemäss eigener Datenschutzerklärung.',
  },
  'book.fallback': {
    en: 'The calendar is not connected yet, so the button opens an email.',
    de: 'Der Kalender ist noch nicht verbunden, darum öffnet der Button eine E-Mail.',
  },
  'book.subject': { en: '30-minute call', de: '30-Minuten-Gespräch' },

  'footer.legal': { en: 'Impressum & privacy', de: 'Impressum & Datenschutz' },
  'footer.place': { en: 'Recuro · Bern, Switzerland', de: 'Recuro · Bern, Schweiz' },

  'legal.title': { en: 'Impressum & privacy', de: 'Impressum & Datenschutz' },
  'legal.imprintTitle': { en: 'Impressum', de: 'Impressum' },
  'legal.imprintLead': { en: 'Responsible for this site:', de: 'Verantwortlich für diese Seite:' },
  'legal.privacyTitle': { en: 'Privacy', de: 'Datenschutz' },
  'legal.privacyNone': {
    en: 'This site sets no cookies and uses no analytics or trackers. The calculator runs in your browser; the numbers you type are not stored or sent.',
    de: 'Diese Seite setzt keine Cookies und nutzt weder Analyse-Tools noch Tracker. Der Rechner läuft in Ihrem Browser; die eingegebenen Zahlen werden weder gespeichert noch übermittelt.',
  },
  'legal.privacyLang': {
    en: 'If you switch the language, that choice is kept in your browser’s local storage so the page opens in it next time. It never leaves your device.',
    de: 'Wenn Sie die Sprache wechseln, merkt sich Ihr Browser die Wahl im lokalen Speicher. Sie verlässt Ihr Gerät nicht.',
  },
  'legal.privacyCal': {
    en: 'Booking a call takes you to Cal.com. Cal.com processes what you enter there (name, email, time) under its own privacy policy. Recuro uses it only to hold the call.',
    de: 'Für die Buchung gelangen Sie zu Cal.com. Cal.com verarbeitet Ihre Angaben dort (Name, E-Mail, Termin) gemäss eigener Datenschutzerklärung. Recuro nutzt sie nur für das Gespräch.',
  },
  'legal.privacyHost': {
    en: 'The site is hosted on GitHub Pages. GitHub may log visitors’ IP addresses for security, as described in GitHub’s privacy statement.',
    de: 'Die Seite liegt auf GitHub Pages. GitHub kann aus Sicherheitsgründen IP-Adressen protokollieren, wie in der Datenschutzerklärung von GitHub beschrieben.',
  },
  'legal.back': { en: 'Back to the start', de: 'Zurück zur Startseite' },

  'notfound.description': { en: 'This page doesn’t exist.', de: 'Diese Seite gibt es nicht.' },
  'notfound.title': { en: 'This page doesn’t exist.', de: 'Diese Seite gibt es nicht.' },
  'notfound.link': { en: 'Back to recuro.ch', de: 'Zurück zu recuro.ch' },
};
