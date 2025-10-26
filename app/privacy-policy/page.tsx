export const metadata = {
  title: "Polityka prywatności | wiedza.joga.yoga",
  description:
    "Dowiedz się, w jaki sposób wiedza.joga.yoga chroni Twoje dane osobowe, pliki cookies i zgodność z RODO (GDPR).",
  robots: "index,follow",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="prose lg:prose-xl mx-auto p-8">
      <h1>Polityka prywatności</h1>
      <p>Data ostatniej aktualizacji: 26 października 2025 r.</p>

      <h2>1. Administrator danych</h2>
      <p>
        Administratorem danych osobowych jest <strong>Sara Namaskar</strong>,
        z siedzibą w Polsce, adres e-mail: namaskar@joga.yoga.
      </p>

      <h2>2. Zakres przetwarzania danych</h2>
      <p>
        Gromadzimy wyłącznie dane niezbędne do świadczenia usług, takie jak adres e-mail,
        imię (jeśli podane) oraz dane techniczne (adres IP zanonimizowany, cookies).
      </p>

      <h2>3. Cele przetwarzania</h2>
      <ul>
        <li>obsługa formularzy kontaktowych, komentarzy i newslettera,</li>
        <li>analiza statystyk odwiedzin i bezpieczeństwa (Google Analytics z anonimizacją IP),</li>
        <li>utrzymanie funkcjonalności strony i usprawnienie doświadczenia użytkownika.</li>
      </ul>

      <h2>4. Pliki cookies</h2>
      <p>
        Strona korzysta z plików cookies w celu zapewnienia prawidłowego działania serwisu
        oraz analityki. Możesz zarządzać ustawieniami cookies w swojej przeglądarce.
      </p>

      <h2>5. Udostępnianie danych</h2>
      <p>
        Dane mogą być przekazywane podmiotom przetwarzającym (np. dostawcom hostingu, narzędzi analitycznych)
        wyłącznie na podstawie umów powierzenia i w zgodzie z RODO.
      </p>

      <h2>6. Twoje prawa</h2>
      <ul>
        <li>dostępu do swoich danych,</li>
        <li>sprostowania lub usunięcia danych,</li>
        <li>ograniczenia przetwarzania,</li>
        <li>wniesienia sprzeciwu,</li>
        <li>przeniesienia danych,</li>
        <li>złożenia skargi do Prezesa UODO (uodo.gov.pl).</li>
      </ul>

      <h2>7. Kontakt w sprawach prywatności</h2>
      <p>
        Wszelkie zapytania dotyczące ochrony danych prosimy kierować na adres:
        <a href="mailto:saranamaskar@joga.yoga"> hello@wiedza.joga.yoga</a>.
      </p>

      <h2>8. Zmiany w polityce prywatności</h2>
      <p>
        Polityka może być aktualizowana w związku ze zmianami przepisów lub funkcjonalności serwisu.
        Aktualna wersja zawsze dostępna jest na tej stronie.
      </p>
    </main>
  );
}
