import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Hakkında",
  description: "Verinin nereden geldiği, neyi saklayıp neyi saklamadığımız ve hangi okulların geleceği.",
};

export default function About() {
  return (
    <>
      <SiteHeader />
      <main id="icerik" className="page prose">
        <h1 className="board-title" style={{ marginBottom: "1.5rem" }}>
          Hakkında
        </h1>
        <p>
          OzuHelper, öğrencilerin çakışmayan ders programlarını hızlıca bulması için yapılmış bağımsız bir araçtır.
          Hiçbir üniversitenin resmi hizmeti değildir.
        </p>
        <h2 className="group-title">Veriler nereden geliyor?</h2>
        <p>
          Dersler, şubeler ve saatler üniversitenin herkese açık “Açılan Dersler” ekranından alınır. Her sayfada son
          güncelleme zamanı yazar. Kaydını yapmadan önce bilgileri okulunun sisteminden kontrol et.
        </p>
        <h2 className="group-title">Ne saklıyoruz?</h2>
        <p>
          Hesap yok, kişisel veri yok. Seçtiğin dersler yalnızca bu tarayıcıda ve paylaştığın linkin içinde durur.
          Programlar da senin cihazında hesaplanır.
        </p>
        <h2 className="group-title">Hangi okullar var?</h2>
        <p>Şu an Özyeğin Üniversitesi. Başka okullar sırayla eklenecek.</p>

        <p>
          Ders kaydı, AKTS sınırı, dersten çekilme ve ders tekrarı kurallarını sade anlatımla{" "}
          <Link href="/ozyegin/rehber" className="link">
            öğrenci rehberinde
          </Link>{" "}
          topladık.
        </p>

        <p>
          Eksik, bozuk ya da yanlış bir şey görürsen{" "}
          <Link href="/ozyegin/geri-bildirim" className="link">
            geri bildirim
          </Link>{" "}
          bırak; isim istemiyoruz.
        </p>
      </main>
    </>
  );
}
